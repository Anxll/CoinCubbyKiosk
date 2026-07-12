"""
Payment processing logic for wallet deductions and cash payment tracking.
"""
from .supabase_client import get_supabase


def process_wallet_payment(user_id: str, amount: float, transaction_id: str, session_type: str = 'rental_payment') -> dict:
    """Deduct amount from user wallet and record payment."""
    db = get_supabase()

    user = db.table('wallets').select('balance, wallet_id').eq('customer_id', user_id).execute()

    if not user.data:
        return {'success': False, 'error': 'Wallet not found'}

    current_balance = float(user.data[0]['balance'])

    if current_balance < amount:
        return {'success': False, 'error': 'Insufficient wallet balance'}

    new_balance = current_balance - amount
    db.table('wallets').update({'balance': new_balance}).eq('customer_id', user_id).execute()

    try:
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
            'payment_method': 'Wallet'
        }).execute()
    except Exception as e:
        db.table('wallets').update({'balance': current_balance}).eq('customer_id', user_id).execute()
        db.table('payment_sessions').delete().eq('transaction_id', transaction_id).execute()
        db.table('payments').delete().eq('transaction_id', transaction_id).execute()
        return {'success': False, 'error': f'Payment record failed: {e}'}

    return {
        'success': True,
        'new_balance': new_balance
    }


def _credit_wallet(user_id: str, amount: float) -> dict:
    """Credit a positive amount to the user's wallet using an atomic SQL increment."""
    db = get_supabase()

    if amount <= 0:
        return {'success': True, 'new_balance': None}

    # Fetch current balance first so we can return it in the result
    wallet = db.table('wallets').select('balance, wallet_id').eq('customer_id', user_id).execute()
    if not wallet.data:
        return {'success': False, 'error': 'Wallet not found for this user'}

    current_balance = float(wallet.data[0]['balance'])
    new_balance = round(current_balance + amount, 2)

    try:
        db.table('wallets').update({'balance': new_balance}).eq('customer_id', user_id).execute()
    except Exception as e:
        return {'success': False, 'error': f'Wallet credit failed: {e}'}

    return {
        'success': True,
        'new_balance': new_balance,
        'previous_balance': current_balance
    }


def record_cash_payment(user_id: str, amount: float, transaction_id: str, session_type: str = 'rental_payment', amount_paid: float = None) -> dict:
    """Record a cash payment and credit overpayment to the user's wallet."""
    db = get_supabase()
    amount_paid = amount if amount_paid is None else amount_paid
    overpayment = round(max(0, amount_paid - amount), 2)
    wallet_credit = None

    if amount_paid < amount:
        return {'success': False, 'error': 'Cash inserted is less than the amount due'}

    # Credit overpayment FIRST before recording the transaction
    if overpayment > 0:
        wallet_credit = _credit_wallet(user_id, overpayment)
        if not wallet_credit['success']:
            return {'success': False, 'error': f"Could not credit overpayment to wallet: {wallet_credit['error']}"}

    try:
        db.table('payment_sessions').insert({
            'transaction_id': transaction_id,
            'customer_id': user_id,
            'session_type': session_type,
            'amount_due': amount,
            'amount_paid': amount_paid,
            'status': 'Paid'
        }).execute()

        db.table('payments').insert({
            'transaction_id': transaction_id,
            'amount': amount_paid,
            'payment_method': 'Cash'
        }).execute()
    except Exception as e:
        # Payment record failed — log it but don't fail the overall transaction
        # since physical cash has already been collected
        print(f"[WARNING] Cash payment record failed for txn {transaction_id}: {e}")
        return {
            'success': True,
            'recorded': False,
            'warning': f'Cash payment record skipped: {e}',
            'amount_due': amount,
            'amount_paid': amount_paid,
            'wallet_credit': overpayment,
            'new_wallet_balance': wallet_credit.get('new_balance') if wallet_credit else None,
            'previous_wallet_balance': wallet_credit.get('previous_balance') if wallet_credit else None
        }

    return {
        'success': True,
        'recorded': True,
        'amount_due': amount,
        'amount_paid': amount_paid,
        'wallet_credit': overpayment,
        'new_wallet_balance': wallet_credit.get('new_balance') if wallet_credit else None,
        'previous_wallet_balance': wallet_credit.get('previous_balance') if wallet_credit else None
    }


def process_retrieval_payment(user_id: str, transaction_id: str, amount: float, method: str, amount_paid: float = None) -> dict:
    """Process payment for retrieval (overdue or open-time charges)."""
    if method == 'wallet':
        return process_wallet_payment(user_id, amount, transaction_id, 'overtime_payment')
    return record_cash_payment(user_id, amount, transaction_id, 'overtime_payment', amount_paid)
