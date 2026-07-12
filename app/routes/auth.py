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
