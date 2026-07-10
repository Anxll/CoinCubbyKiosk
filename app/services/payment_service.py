"""
Payment processing logic — wallet deductions and cash payment tracking.
"""
from .supabase_client import get_supabase
from ..config import Config

def process_wallet_payment(user_id: str, amount: float, transaction_id: str, session_type: str = 'rental_payment') -> dict:
    """Deduct amount from user wallet and record payment."""
    db = get_supabase()

    # Get current balance
    user = db.table('wallets').select('balance, wallet_id').eq('customer_id', user_id).execute()
    
    if not user.data:
        return {'success': False, 'error': 'Wallet not found'}
        
    current_balance = float(user.data[0]['balance'])

    if current_balance < amount:
        return {'success': False, 'error': 'Insufficient wallet balance'}

    new_balance = current_balance - amount

    # Update wallet balance
    db.table('wallets').update({'balance': new_balance}).eq('customer_id', user_id).execute()

    # Create payment session
    session_res = db.table('payment_sessions').insert({
        'transaction_id': transaction_id,
        'customer_id': user_id,
        'session_type': session_type,
        'amount_due': amount,
        'amount_paid': amount,
        'status': 'Paid'
    }).execute()

    # Record payment
    db.table('payments').insert({
        'transaction_id': transaction_id,
        'amount': amount,
        'payment_method': 'Wallet'
    }).execute()

    return {
        'success': True,
        'new_balance': new_balance
    }


def record_cash_payment(user_id: str, amount: float, transaction_id: str, session_type: str = 'rental_payment') -> dict:
    """Record a cash payment."""
    db = get_supabase()
    
    # Create payment session
    db.table('payment_sessions').insert({
        'transaction_id': transaction_id,
        'customer_id': user_id,
        'session_type': session_type,
        'amount_due': amount,
        'amount_paid': amount,
        'status': 'Paid'
    }).execute()

    db.table('payments').insert({
        'transaction_id': transaction_id,
        'amount': amount,
        'payment_method': 'Cash'
    }).execute()

    return {'success': True}


def process_retrieval_payment(user_id: str, transaction_id: str, amount: float, method: str) -> dict:
    """Process payment for retrieval (overdue or open-time charges)."""
    if method == 'wallet':
        return process_wallet_payment(user_id, amount, transaction_id, 'overtime_payment')
    else:
        return record_cash_payment(user_id, amount, transaction_id, 'overtime_payment')
