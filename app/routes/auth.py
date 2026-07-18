"""
Authentication routes — login and user info.
Registration is handled externally via the webapp.
"""
from flask import Blueprint, request, jsonify
import bcrypt
from supabase import create_client
from ..services.supabase_client import get_supabase
from ..config import Config
from ..services.kiosk_security import require_kiosk_token

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
@require_kiosk_token
def login():
    """Authenticate user with 6-digit user code and 4-digit PIN."""
    data = request.get_json()
    user_code = data.get('user_code', '').strip()
    pin = data.get('pin', '').strip()

    if not user_code or not pin:
        return jsonify({'error': 'User ID and PIN are required'}), 400

    try:
        db = get_supabase()
        # In supabaseschema, the customer email maps to the auth.users email
        result = db.table('customers').select('customer_id, full_name, user_id, email').eq('user_id', user_code).execute()

        if not result.data:
            return jsonify({'error': 'Invalid User ID or Password'}), 401

        user = result.data[0]

        # Verify password via a temporary Supabase client so auth state does not leak across requests
        try:
            auth_client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
            # We must use the email to sign in to Supabase auth
            auth_response = auth_client.auth.sign_in_with_password({
                "email": user['email'],
                "password": pin
            })
        except Exception as e:
            # AuthApiError is thrown if password is wrong
            return jsonify({'error': 'Invalid User ID or Password'}), 401

        # Get wallet balance from wallets table
        wallet_result = db.table('wallets').select('balance').eq('customer_id', user['customer_id']).execute()
        wallet_balance = float(wallet_result.data[0]['balance']) if wallet_result.data else 0.00

        # Get active rental count (transactions table, status = 'Active')
        rentals = db.table('transactions').select('transaction_id').eq('customer_id', user['customer_id']).eq('status', 'Active').execute()

        return jsonify({
            'success': True,
            'user': {
                'id': user['customer_id'],
                'user_code': user['user_id'],
                'full_name': user['full_name'],
                'wallet_balance': wallet_balance,
                'max_rentals': 3, # Not in schema, keeping hardcoded limit
                'active_rental_count': len(rentals.data)
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/user/<user_code>', methods=['GET'])
@require_kiosk_token
def get_user(user_code):
    """Get user profile including wallet balance and active rentals."""
    try:
        db = get_supabase()
        result = db.table('customers').select('customer_id, full_name, user_id').eq('user_id', user_code).execute()

        if not result.data:
            return jsonify({'error': 'User not found'}), 404

        user = result.data[0]
        
        wallet_result = db.table('wallets').select('balance').eq('customer_id', user['customer_id']).execute()
        wallet_balance = float(wallet_result.data[0]['balance']) if wallet_result.data else 0.00
        
        rentals = db.table('transactions').select('transaction_id').eq('customer_id', user['customer_id']).eq('status', 'Active').execute()

        return jsonify({
            'user': {
                'id': user['customer_id'],
                'user_code': user['user_id'],
                'full_name': user['full_name'],
                'wallet_balance': wallet_balance,
                'max_rentals': 3,
                'active_rental_count': len(rentals.data)
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


import random
from datetime import datetime, timedelta, timezone

@auth_bp.route('/admin/login', methods=['POST'])
@require_kiosk_token
def admin_login():
    """Authenticate kiosk admin with kiosk_admin_id and password."""
    data = request.get_json()
    kiosk_admin_id = data.get('kiosk_admin_id', '').strip()
    kiosk_admin_pwd = data.get('kiosk_admin_password', '').strip()
    
    if not kiosk_admin_id or not kiosk_admin_pwd:
        return jsonify({'error': 'Admin ID and Password are required'}), 400

    try:
        db = get_supabase()
        # Verify from admin table
        result = db.table('admin').select('id').eq('kiosk_admin_id', kiosk_admin_id).eq('kiosk_admin_password', kiosk_admin_pwd).execute()
        
        if not result.data:
            return jsonify({'error': 'Invalid Admin ID or Password'}), 401
            
        admin_uuid = result.data[0]['id']
        
        # Generate 6-digit OTP
        otp = str(random.randint(100000, 999999))
        
        # Insert OTP into kiosk_verification_codes
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()
        db.table('kiosk_verification_codes').insert({
            'admin_id': admin_uuid,
            'verification_code': otp,
            'status': 'Pending',
            'expires_at': expires_at
        }).execute()
        
        return jsonify({
            'success': True,
            'admin_id': admin_uuid,
            'generated_otp': otp # Sending it back just to simulate the UI alert
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/admin/verify-otp', methods=['POST'])
@require_kiosk_token
def admin_verify_otp():
    """Verify the 6-digit OTP for the admin."""
    data = request.get_json()
    admin_uuid = data.get('admin_id', '').strip()
    otp = data.get('verification_code', '').strip()
    
    if not admin_uuid or not otp:
        return jsonify({'error': 'Admin ID and OTP are required'}), 400
        
    try:
        db = get_supabase()
        now = datetime.now(timezone.utc).isoformat()
        
        # Find a matching, pending OTP that hasn't expired
        result = db.table('kiosk_verification_codes') \
            .select('verification_id, status') \
            .eq('admin_id', admin_uuid) \
            .eq('verification_code', otp) \
            .eq('status', 'Pending') \
            .gte('expires_at', now) \
            .execute()
            
        if not result.data:
            return jsonify({'error': 'Invalid or expired Verification PIN.'}), 401
            
        # Mark as Used
        verify_id = result.data[0]['verification_id']
        db.table('kiosk_verification_codes').update({'status': 'Used'}).eq('verification_id', verify_id).execute()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/admin/resend-otp', methods=['POST'])
@require_kiosk_token
def admin_resend_otp():
    """Generate a fresh OTP for the admin (resend flow)."""
    data = request.get_json()
    admin_uuid = data.get('admin_id', '').strip()

    if not admin_uuid:
        return jsonify({'error': 'Admin ID is required'}), 400

    try:
        db = get_supabase()

        # Expire any existing pending OTPs for this admin
        db.table('kiosk_verification_codes') \
            .update({'status': 'Expired'}) \
            .eq('admin_id', admin_uuid) \
            .eq('status', 'Pending') \
            .execute()

        # Generate a fresh 6-digit OTP
        otp = str(random.randint(100000, 999999))
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()

        db.table('kiosk_verification_codes').insert({
            'admin_id': admin_uuid,
            'verification_code': otp,
            'status': 'Pending',
            'expires_at': expires_at
        }).execute()

        return jsonify({
            'success': True,
            'generated_otp': otp  # For display/testing only
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
