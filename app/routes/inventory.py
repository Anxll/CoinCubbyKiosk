"""
Inventory management routes — interact with the device_inventory table.
"""
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime, timezone
from ..services.supabase_client import get_supabase
from ..config import Config
from ..services.kiosk_security import require_kiosk_token

inventory_bp = Blueprint('inventory', __name__)

def _get_current_device_id(db):
    device_res = db.table('devices').select('device_id').eq('device_code', Config.KIOSK_ID).execute()
    if not device_res.data:
        return None
    return device_res.data[0]['device_id']

@inventory_bp.route('/', methods=['GET'])
@require_kiosk_token
def get_inventory():
    """Fetch current inventory for the kiosk."""
    db = get_supabase()
    device_id = _get_current_device_id(db)
    if not device_id:
        return jsonify({'error': 'Device not found'}), 404

    inv_res = db.table('device_inventory').select('*').eq('device_id', device_id).execute()
    
    if not inv_res.data:
        # Return defaults if no row exists yet
        return jsonify({
            'change_amount': 0.00,
            'last_refilled_at': None,
            'last_refilled_amount': 0.00
        })

    return jsonify(inv_res.data[0])

@inventory_bp.route('/refill', methods=['POST'])
@require_kiosk_token
def refill_inventory():
    """Add change amount to inventory."""
    data = request.get_json() or {}
    try:
        amount_to_add = float(data.get('amount', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid amount'}), 400

    if amount_to_add <= 0:
        return jsonify({'error': 'Amount must be greater than 0'}), 400

    db = get_supabase()
    device_id = _get_current_device_id(db)
    if not device_id:
        return jsonify({'error': 'Device not found'}), 404

    # Get current inventory
    inv_res = db.table('device_inventory').select('*').eq('device_id', device_id).execute()
    now_str = datetime.now(timezone.utc).isoformat()

    if inv_res.data:
        # Update existing
        current_amount = float(inv_res.data[0].get('change_amount', 0))
        new_total = current_amount + amount_to_add
        
        update_data = {
            'change_amount': new_total,
            'last_refilled_amount': amount_to_add,
            'last_refilled_at': now_str,
            'updated_at': now_str
        }
        res = db.table('device_inventory').update(update_data).eq('device_id', device_id).execute()
        if res.data:
            return jsonify({'success': True, 'inventory': res.data[0]})
        return jsonify({'error': 'Failed to update inventory'}), 500
    else:
        # Insert new
        insert_data = {
            'device_id': device_id,
            'change_amount': amount_to_add,
            'last_refilled_amount': amount_to_add,
            'last_refilled_at': now_str,
            'updated_at': now_str
        }
        res = db.table('device_inventory').insert(insert_data).execute()
        if res.data:
            return jsonify({'success': True, 'inventory': res.data[0]})
        return jsonify({'error': 'Failed to insert inventory'}), 500

@inventory_bp.route('/reset', methods=['POST'])
@require_kiosk_token
def reset_inventory():
    """Reset inventory change amount to zero."""
    db = get_supabase()
    device_id = _get_current_device_id(db)
    if not device_id:
        return jsonify({'error': 'Device not found'}), 404

    now_str = datetime.now(timezone.utc).isoformat()
    
    inv_res = db.table('device_inventory').select('*').eq('device_id', device_id).execute()
    if inv_res.data:
        update_data = {
            'change_amount': 0.00,
            'updated_at': now_str
        }
        res = db.table('device_inventory').update(update_data).eq('device_id', device_id).execute()
        if res.data:
            return jsonify({'success': True, 'inventory': res.data[0]})
    
    return jsonify({'success': True, 'inventory': {'change_amount': 0.00}})
