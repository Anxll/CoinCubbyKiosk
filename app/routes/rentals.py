"""
Rental management routes — create, retrieve, list active, pricing.
"""
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timezone, timedelta
from ..services.supabase_client import get_supabase
from ..services.rental_service import calculate_fixed_rental_fee, calculate_open_time_charges, calculate_overdue_charges
from ..services.payment_service import process_wallet_payment, record_cash_payment, process_retrieval_payment
from ..config import Config

rentals_bp = Blueprint('rentals', __name__)

@rentals_bp.route('/pricing', methods=['GET'])
def get_pricing():
    """Return fixed duration pricing tiers and rate info based on compartment ID."""
    compartment_id = request.args.get('compartment_id')
    
    if not compartment_id:
        return jsonify({'error': 'Compartment ID is required'}), 400
        
    try:
        db = get_supabase()
        l_res = db.table('lockers').select('size_type_id').eq('locker_id', compartment_id).execute()
        if not l_res.data:
            return jsonify({'error': 'Compartment not found'}), 404
            
        rate_res = db.table('rates').select('price_per_hour').eq('size_type_id', l_res.data[0]['size_type_id']).execute()
        rate_per_hour = float(rate_res.data[0]['price_per_hour']) if rate_res.data else 10.00
        
        # Build dynamic tiers
        hours_to_offer = [1, 3, 6, 12, 24, 48, 72]
        tiers = []
        for h in hours_to_offer:
            pricing = calculate_fixed_rental_fee(h, rate_per_hour)
            label = f"{h} Hour{'s' if h>1 else ''}"
            if h >= 24:
                label = f"{h//24} Day{'s' if h>=48 else ''}"
            tiers.append({
                'label': label,
                'hours': h,
                'price': pricing['rental_fee']
            })
            
        return jsonify({
            'fixed_duration_tiers': tiers,
            'rate_per_hour': rate_per_hour,
            'service_fee': Config.SERVICE_FEE
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@rentals_bp.route('/', methods=['POST'])
def create_rental():
    """Create a new rental (transaction)."""
    data = request.get_json()
    user_id = data.get('user_id')
    compartment_id = data.get('compartment_id')
    rental_type = data.get('rental_type')  # 'fixed' or 'open_time'
    duration_hours = data.get('duration_hours')  # for fixed only
    payment_method = data.get('payment_method')  # 'wallet' or 'cash'

    try:
        db = get_supabase()

        # Validate user rental limit (using transactions)
        active = db.table('transactions').select('transaction_id').eq('customer_id', user_id).eq('status', 'Active').execute()
        if len(active.data) >= Config.MAX_RENTALS_PER_USER:
            return jsonify({'error': 'Maximum rental limit reached (3)'}), 400

        # Validate locker is available and get size_type_id
        comp = db.table('lockers').select('*').eq('locker_id', compartment_id).single().execute()
        
        if comp.data['status'] != 'Available':
            return jsonify({'error': 'Compartment is not available'}), 400
            
        # Manually join rate since supabase python might not cleanly handle this depending on FK
        # Wait, there's no FK from lockers to rates. We must use size_type_id
        rate_res = db.table('rates').select('rate_id, price_per_hour').eq('size_type_id', comp.data['size_type_id']).execute()
        rate_id = rate_res.data[0]['rate_id']
        rate_per_hour = float(rate_res.data[0]['price_per_hour'])

        now = datetime.now(timezone.utc)
        
        duration_minutes = duration_hours * 60 if rental_type == 'fixed' else None
        end_time = (now + timedelta(hours=duration_hours)).isoformat() if rental_type == 'fixed' else None

        # Insert transaction
        trans_data = {
            'customer_id': user_id,
            'locker_id': compartment_id,
            'rate_id': rate_id,
            'start_time': now.isoformat(),
            'end_time': end_time,
            'duration_minutes': duration_minutes,
            'status': 'Active'
        }
        
        result = db.table('transactions').insert(trans_data).execute()
        transaction = result.data[0]

        # Process payment for fixed duration
        if rental_type == 'fixed':
            pricing = calculate_fixed_rental_fee(duration_hours, rate_per_hour)
            total_amount = pricing['total']
            
            if payment_method == 'wallet':
                pay_result = process_wallet_payment(user_id, total_amount, transaction['transaction_id'])
                if not pay_result['success']:
                    # Revert transaction
                    db.table('transactions').delete().eq('transaction_id', transaction['transaction_id']).execute()
                    return jsonify({'error': pay_result['error']}), 400
            else:
                record_cash_payment(user_id, total_amount, transaction['transaction_id'])

        # Mark compartment as occupied
        db.table('lockers').update({'status': 'Occupied'}).eq('locker_id', compartment_id).execute()

        return jsonify({
            'success': True,
            'rental': {
                'id': transaction['transaction_id'],
                'compartment_code': comp.data['locker_number'],
                'rental_type': rental_type,
                'started_at': transaction['start_time'],
                'expires_at': transaction.get('end_time'),
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@rentals_bp.route('/active/<user_id>', methods=['GET'])
def get_active_rentals(user_id):
    """Get all active rentals for a user with status and charges."""
    try:
        db = get_supabase()
        
        # Get active transactions
        result = db.table('transactions').select('''
            *, lockers(locker_number, storage_size_type(name)), rates(price_per_hour)
        ''').eq('customer_id', user_id).eq('status', 'Active').order('start_time', desc=True).execute()

        rentals = []
        for r in result.data:
            rate = float(r['rates']['price_per_hour']) if r.get('rates') else 10.0
            rental_type = 'fixed' if r.get('duration_minutes') else 'open_time'
            
            rental_info = {
                'id': r['transaction_id'],
                'compartment_code': r['lockers']['locker_number'],
                'compartment_size': r['lockers']['storage_size_type']['name'] if r['lockers'].get('storage_size_type') else 'unknown',
                'rental_type': rental_type,
                'started_at': r['start_time'],
                'expires_at': r.get('end_time'),
                'duration_hours': r.get('duration_minutes') // 60 if r.get('duration_minutes') else None,
            }

            now = datetime.now(timezone.utc)

            if rental_type == 'fixed' and r.get('end_time'):
                expires = datetime.fromisoformat(r['end_time'].replace('Z', '+00:00'))
                if now > expires:
                    charges = calculate_overdue_charges(r['end_time'], rate)
                    rental_info['status'] = 'duration_exceeded'
                    rental_info['outstanding'] = charges['total']
                    rental_info['overdue_hours'] = charges['overdue_hours']
                else:
                    rental_info['status'] = 'ready_for_retrieval'
                    rental_info['outstanding'] = 0
            else:
                # Open time
                charges = calculate_open_time_charges(r['start_time'], rate)
                rental_info['status'] = 'ready_for_retrieval'
                rental_info['outstanding'] = charges['total']
                rental_info['elapsed_hours'] = charges['elapsed_hours']

            rentals.append(rental_info)

        return jsonify({'rentals': rentals})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@rentals_bp.route('/<rental_id>/retrieve', methods=['POST'])
def retrieve_rental(rental_id):
    """Process rental retrieval — calculate final charges and unlock."""
    data = request.get_json() or {}
    payment_method = data.get('payment_method')  # needed if there are charges

    try:
        db = get_supabase()
        result = db.table('transactions').select('*, lockers(locker_number, locker_id), rates(price_per_hour)').eq('transaction_id', rental_id).single().execute()
        rental = result.data

        if not rental or rental['status'] != 'Active':
            return jsonify({'error': 'Rental not found or already retrieved'}), 404

        amount_due = 0
        now = datetime.now(timezone.utc)
        rate = float(rental['rates']['price_per_hour']) if rental.get('rates') else 10.0
        rental_type = 'fixed' if rental.get('duration_minutes') else 'open_time'

        if rental_type == 'fixed' and rental.get('end_time'):
            expires = datetime.fromisoformat(rental['end_time'].replace('Z', '+00:00'))
            if now > expires:
                charges = calculate_overdue_charges(rental['end_time'], rate)
                amount_due = charges['total']
        elif rental_type == 'open_time':
            charges = calculate_open_time_charges(rental['start_time'], rate)
            amount_due = charges['total']
            
            # update the open_time duration so it's recorded
            db.table('transactions').update({'end_time': now.isoformat(), 'duration_minutes': charges['elapsed_hours'] * 60}).eq('transaction_id', rental_id).execute()

        # Process payment if there are charges
        if amount_due > 0 and payment_method:
            pay_result = process_retrieval_payment(rental['customer_id'], rental_id, amount_due, payment_method)
            if not pay_result.get('success'):
                return jsonify({'error': pay_result.get('error', 'Payment failed')}), 400

        # Update rental status
        db.table('transactions').update({
            'status': 'Completed'
        }).eq('transaction_id', rental_id).execute()

        # Free the locker
        db.table('lockers').update({'status': 'Available'}).eq('locker_id', rental['lockers']['locker_id']).execute()

        # Unlock the compartment door DIRECTLY using hardware abstraction, ignore device_commands for now per user instruction
        compartment_code = rental['lockers']['locker_number']
        try:
            current_app.hardware.unlock_door(compartment_code)
        except Exception as e:
            # Don't fail retrieval if hardware error in simulation, just log it
            print(f"Hardware error unlocking door: {e}")

        return jsonify({
            'success': True,
            'compartment_code': compartment_code,
            'amount_charged': amount_due
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
