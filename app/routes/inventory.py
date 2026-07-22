from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from ..services.supabase_client import get_supabase
from ..services.kiosk_security import require_kiosk_token
from ..config import Config

inventory_bp = Blueprint('inventory', __name__)


def _get_device_id(db):
    """Look up device_id using the KIOSK_ID (device_code) config, same as other routes."""
    device_res = db.table('devices').select('device_id').eq('device_code', Config.KIOSK_ID).execute()
    if not device_res.data:
        return None
    return device_res.data[0]['device_id']


@inventory_bp.route('/status', methods=['GET'])
@require_kiosk_token
def get_status():
    """Get the current coin inventory status."""
    try:
        db = get_supabase()

        device_id = _get_device_id(db)
        if device_id is None:
            return jsonify({'error': f'Device not found for kiosk code: {Config.KIOSK_ID}'}), 404

        # Check if the device inventory exists, if not create it with 0
        result = db.table('device_inventory').select('*').eq('device_id', device_id).execute()

        if not result.data:
            # Auto-create the inventory row for this device
            new_row = {
                'device_id': device_id,
                'change_amount': 0.00,
                'last_refilled_amount': 0.00
            }
            insert_result = db.table('device_inventory').insert(new_row).execute()
            if not insert_result.data:
                return jsonify({'error': 'Failed to initialize device inventory'}), 500
            data = insert_result.data[0]
        else:
            data = result.data[0]

        return jsonify({
            'change_amount': float(data.get('change_amount', 0)),
            'last_refilled_at': data.get('last_refilled_at'),
            'last_refilled_amount': float(data.get('last_refilled_amount', 0))
        }), 200

    except Exception as e:
        print(f"Error getting inventory status: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@inventory_bp.route('/refill', methods=['POST'])
@require_kiosk_token
def refill_inventory():
    """Refill the coin inventory."""
    req_data = request.get_json()

    refill_amount = req_data.get('amount')

    if refill_amount is None or refill_amount <= 0:
        return jsonify({'error': 'Invalid refill amount'}), 400

    try:
        db = get_supabase()

        device_id = _get_device_id(db)
        if device_id is None:
            return jsonify({'error': f'Device not found for kiosk code: {Config.KIOSK_ID}'}), 404

        # Fetch current balance
        result = db.table('device_inventory').select('change_amount').eq('device_id', device_id).execute()

        if not result.data:
            return jsonify({'error': 'Device inventory not found. Please load the status page first.'}), 404

        current_amount = float(result.data[0].get('change_amount', 0))
        new_amount = current_amount + float(refill_amount)

        update_data = {
            'change_amount': new_amount,
            'last_refilled_amount': refill_amount,
            'last_refilled_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }

        update_res = db.table('device_inventory').update(update_data).eq('device_id', device_id).execute()

        if not update_res.data:
            return jsonify({'error': 'Failed to update inventory'}), 500

        return jsonify({
            'message': 'Inventory refilled successfully',
            'change_amount': new_amount
        }), 200

    except Exception as e:
        print(f"Error refilling inventory: {e}")
        return jsonify({'error': 'Internal server error'}), 500
