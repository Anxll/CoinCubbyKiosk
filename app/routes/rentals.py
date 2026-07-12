"""
Rental management routes — create, retrieve, list active, pricing.
"""
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timezone, timedelta
from ..services.supabase_client import get_supabase
from ..services.rental_service import calculate_fixed_rental_fee, calculate_open_time_charges, calculate_overdue_charges
from ..services.payment_service import process_wallet_payment, record_cash_payment, process_retrieval_payment
from ..config import Config
from ..services.kiosk_security import require_kiosk_token

rentals_bp = Blueprint('rentals', __name__)


def _get_current_device_id(db):
    device_res = db.table('devices').select('device_id').eq('device_code', Config.DEVICE_CODE).execute()
    if not device_res.data:
        return None
    return device_res.data[0]['device_id']

@rentals_bp.route('/pricing', methods=['GET'])
@require_kiosk_token
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
        if not rate_res.data:
            return jsonify({'error': 'Rate not configured for this compartment'}), 500
        rate_per_hour = float(rate_res.data[0]['price_per_hour'])
        
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
            'rate_per_hour': rate_per_hour
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@rentals_bp.route('/', methods=['POST'])
@require_kiosk_token
def create_rental():
    """Create a new rental (transaction)."""
    data = request.get_json()
    user_id = data.get('user_id')
    compartment_id = data.get('compartment_id')
    rental_type = data.get('rental_type')  # 'fixed' or 'open_time'
    duration_hours = data.get('duration_hours')  # for fixed only
    payment_method = data.get('payment_method')  # 'wallet' or 'cash'
    cash_inserted = data.get('cash_inserted')

    if rental_type not in ('fixed', 'open_time'):
        return jsonify({'error': 'Invalid rental type'}), 400
    if rental_type == 'fixed' and (not isinstance(duration_hours, int) or duration_hours <= 0):
        return jsonify({'error': 'Duration is required for fixed rentals'}), 400
    if payment_method not in ('wallet', 'cash', None):
        return jsonify({'error': 'Invalid payment method'}), 400

    try:
        db = get_supabase()
        device_id = _get_current_device_id(db)
        if not device_id:
            return jsonify({'error': 'Device not found'}), 404

        # Validate user rental limit (using transactions)
        active = db.table('transactions').select('transaction_id').eq('customer_id', user_id).eq('status', 'Active').execute()
        if len(active.data) >= Config.MAX_RENTALS_PER_USER:
            return jsonify({'error': 'Maximum rental limit reached (3)'}), 400

        # Validate locker is available and get size_type_id
        comp = db.table('lockers').select('*').eq('locker_id', compartment_id).eq('device_id', device_id).single().execute()
        
        if comp.data['status'] != 'Available':
            return jsonify({'error': 'Compartment is not available'}), 400
            
        # Manually join rate since supabase python might not cleanly handle this depending on FK
        # Wait, there's no FK from lockers to rates. We must use size_type_id
        rate_res = db.table('rates').select('rate_id, price_per_hour').eq('size_type_id', comp.data['size_type_id']).execute()
        if not rate_res.data:
            return jsonify({'error': 'Rate not configured for this compartment'}), 500
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
            'status': 'Pending'
        }
        
        result = db.table('transactions').insert(trans_data).execute()
        transaction = result.data[0]

        # Process payment for fixed duration
        if rental_type == 'fixed':
            pricing = calculate_fixed_rental_fee(duration_hours, rate_per_hour)
            total_amount = pricing['total']
            wallet_balance_before = None
            cash_wallet_balance_before = None
            
            if payment_method == 'wallet':
                wallet_lookup = db.table('wallets').select('balance').eq('customer_id', user_id).execute()
                wallet_balance_before = float(wallet_lookup.data[0]['balance']) if wallet_lookup.data else None
                pay_result = process_wallet_payment(user_id, total_amount, transaction['transaction_id'])
                if not pay_result['success']:
                    # Revert transaction
                    db.table('transactions').delete().eq('transaction_id', transaction['transaction_id']).execute()
                    return jsonify({'error': pay_result['error']}), 400
            else:
                cash_amount_paid = float(cash_inserted) if cash_inserted is not None else total_amount
                pay_result = record_cash_payment(user_id, total_amount, transaction['transaction_id'], amount_paid=cash_amount_paid)
                if not pay_result['success']:
                    db.table('transactions').delete().eq('transaction_id', transaction['transaction_id']).execute()
                    return jsonify({'error': pay_result['error']}), 400
                cash_wallet_balance_before = pay_result.get('previous_wallet_balance')

        try:
            # Mark compartment as occupied
            db.table('lockers').update({'status': 'Occupied'}).eq('locker_id', compartment_id).execute()
            db.table('transactions').update({'status': 'Active'}).eq('transaction_id', transaction['transaction_id']).execute()
        except Exception as e:
            if rental_type == 'fixed' and payment_method == 'wallet' and wallet_balance_before is not None:
                db.table('wallets').update({'balance': wallet_balance_before}).eq('customer_id', user_id).execute()
                db.table('payment_sessions').delete().eq('transaction_id', transaction['transaction_id']).execute()
                db.table('payments').delete().eq('transaction_id', transaction['transaction_id']).execute()
                db.table('transactions').delete().eq('transaction_id', transaction['transaction_id']).execute()
            elif rental_type == 'fixed' and payment_method == 'cash':
                if cash_wallet_balance_before is not None:
                    db.table('wallets').update({'balance': cash_wallet_balance_before}).eq('customer_id', user_id).execute()
                db.table('payment_sessions').delete().eq('transaction_id', transaction['transaction_id']).execute()
                db.table('payments').delete().eq('transaction_id', transaction['transaction_id']).execute()
                db.table('transactions').delete().eq('transaction_id', transaction['transaction_id']).execute()
            return jsonify({'error': f'Unable to finalize rental: {e}'}), 500

        return jsonify({
            'success': True,
            'amount_charged': total_amount if rental_type == 'fixed' else 0,
            'amount_paid': pay_result.get('amount_paid') if rental_type == 'fixed' and payment_method == 'cash' else total_amount if rental_type == 'fixed' else 0,
            'wallet_credit': pay_result.get('wallet_credit', 0) if rental_type == 'fixed' and payment_method == 'cash' else 0,
            'new_wallet_balance': pay_result.get('new_wallet_balance') if rental_type == 'fixed' and payment_method == 'cash' else None,
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
@require_kiosk_token
def get_active_rentals(user_id):
    """Get all active rentals for a user with status and charges."""
    try:
        db = get_supabase()
        device_id = _get_current_device_id(db)
        if not device_id:
            return jsonify({'error': 'Device not found'}), 404
        
        # Get active transactions
        result = db.table('transactions').select('''
            *, lockers(locker_number, size_type_id, storage_size_type(name), device_id)
        ''').eq('customer_id', user_id).eq('status', 'Active').order('start_time', desc=True).execute()

        rentals = []
        for r in result.data:
            rate_res = db.table('rates').select('price_per_hour').eq('size_type_id', r['lockers']['size_type_id']).execute()
            if not rate_res.data:
                return jsonify({'error': f'Rate not configured for size type {r["lockers"]["size_type_id"]}'}), 500
            if r['lockers'].get('device_id') != device_id:
                continue
            rate = float(rate_res.data[0]['price_per_hour'])
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
@require_kiosk_token
def retrieve_rental(rental_id):
    """Process rental retrieval — calculate final charges and unlock."""
    data = request.get_json() or {}
    payment_method = data.get('payment_method')  # needed if there are charges
    user_id = data.get('user_id')
    cash_inserted = data.get('cash_inserted')

    if payment_method not in ('wallet', 'cash', None):
        return jsonify({'error': 'Invalid payment method'}), 400

    try:
        db = get_supabase()
        device_id = _get_current_device_id(db)
        if not device_id:
            return jsonify({'error': 'Device not found'}), 404
        result = db.table('transactions').select('*, lockers(locker_number, locker_id, size_type_id, device_id)').eq('transaction_id', rental_id).single().execute()
        rental = result.data

        if not rental or rental['status'] != 'Active':
            return jsonify({'error': 'Rental not found or already retrieved'}), 404
        if not user_id or rental['customer_id'] != user_id:
            return jsonify({'error': 'Unauthorized rental access'}), 403
        if rental['lockers'].get('device_id') != device_id:
            return jsonify({'error': 'Rental does not belong to this device'}), 403

        amount_due = 0
        now = datetime.now(timezone.utc)
        rate_res = db.table('rates').select('price_per_hour').eq('size_type_id', rental['lockers']['size_type_id']).execute() if rental.get('lockers') else None
        if not rate_res or not rate_res.data:
            return jsonify({'error': 'Rate not configured for this compartment'}), 500
        rate = float(rate_res.data[0]['price_per_hour'])
        rental_type = 'fixed' if rental.get('duration_minutes') else 'open_time'
        existing_payment = db.table('payments').select('payment_id').eq('transaction_id', rental_id).execute()
        already_paid = bool(existing_payment.data)

        if rental_type == 'fixed' and rental.get('end_time'):
            expires = datetime.fromisoformat(rental['end_time'].replace('Z', '+00:00'))
            if now > expires:
                charges = calculate_overdue_charges(rental['end_time'], rate)
                amount_due = charges['total']
        elif rental_type == 'open_time':
            charges = calculate_open_time_charges(rental['start_time'], rate)
            amount_due = charges['total']

        # Process payment if there are charges
        if amount_due > 0 and already_paid:
            amount_due = 0

        if amount_due > 0 and not payment_method:
            return jsonify({'error': 'Payment method is required for this retrieval'}), 400

        if amount_due > 0 and payment_method:
            cash_amount_paid = float(cash_inserted) if payment_method == 'cash' and cash_inserted is not None else None
            pay_result = process_retrieval_payment(rental['customer_id'], rental_id, amount_due, payment_method, cash_amount_paid)
            if not pay_result.get('success'):
                return jsonify({'error': pay_result.get('error', 'Payment failed')}), 400

            if rental_type == 'open_time':
                # update the open_time duration so it's recorded only after payment succeeds
                db.table('transactions').update({
                    'end_time': now.isoformat(),
                    'duration_minutes': charges['elapsed_hours'] * 60
                }).eq('transaction_id', rental_id).execute()
        elif rental_type == 'open_time' and already_paid and not rental.get('end_time'):
            db.table('transactions').update({
                'end_time': now.isoformat(),
                'duration_minutes': charges['elapsed_hours'] * 60
            }).eq('transaction_id', rental_id).execute()

        # Unlock the compartment door DIRECTLY using hardware abstraction, ignore device_commands for now per user instruction
        compartment_code = rental['lockers']['locker_number']
        try:
            current_app.hardware.unlock_door(compartment_code)
        except Exception as e:
            return jsonify({'error': f'Unable to unlock compartment: {e}'}), 500

        # Update rental status after the door unlock succeeds
        db.table('transactions').update({
            'status': 'Completed'
        }).eq('transaction_id', rental_id).execute()

        # Free the locker after unlock succeeds
        db.table('lockers').update({'status': 'Available'}).eq('locker_id', rental['lockers']['locker_id']).execute()

        return jsonify({
            'success': True,
            'compartment_code': compartment_code,
            'amount_charged': amount_due,
            'amount_paid': pay_result.get('amount_paid') if amount_due > 0 and payment_method == 'cash' else amount_due,
            'wallet_credit': pay_result.get('wallet_credit', 0) if amount_due > 0 and payment_method == 'cash' else 0,
            'new_wallet_balance': pay_result.get('new_wallet_balance') if amount_due > 0 and payment_method == 'cash' else None
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
