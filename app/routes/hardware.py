"""
Hardware control routes — door locks, printer, cash acceptors.
"""
from flask import Blueprint, request, jsonify, current_app, Response, stream_with_context
import json
import time
from ..services.kiosk_security import require_kiosk_token
from ..services import notification_service
from ..config import Config

hardware_bp = Blueprint('hardware', __name__)


@hardware_bp.route('/unlock/<compartment_code>', methods=['POST'])
@require_kiosk_token
def unlock_compartment(compartment_code):
    """Unlock a specific compartment door.
    
    Expects JSON body: { "device_code": "AMSJFIWESLFIENSA" }
    The device_code comes from the modules table in Supabase for the target compartment.
    """
    data = request.get_json() or {}
    device_code = data.get('device_code', '').strip()
    if not device_code:
        return jsonify({'error': 'device_code is required in the request body'}), 400
    try:
        current_app.hardware.unlock_door(compartment_code, device_code)
        return jsonify({'success': True, 'message': f'Compartment {compartment_code} unlocked'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/door-status/<compartment_code>', methods=['GET'])
@require_kiosk_token
def door_status(compartment_code):
    """Check if a compartment door is open or closed."""
    try:
        is_open = current_app.hardware.get_door_status(compartment_code)
        return jsonify({'compartment': compartment_code, 'is_open': is_open})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/print-receipt', methods=['POST'])
@require_kiosk_token
def print_receipt():
    """Print a receipt via the thermal printer."""
    data = request.get_json()
    try:
        from ..hardware.thermal_printer import PrinterTimeoutError
        try:
            current_app.hardware.print_receipt(data)
            return jsonify({'success': True})
        except PrinterTimeoutError as te:
            # Fire a Supabase notification so the admin knows paper is out.
            notification_service.notify_no_receipt_paper(kiosk_id=Config.KIOSK_ID)
            return jsonify({
                'error': 'no_paper',
                'message': str(te)
            }), 408
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/cash/start', methods=['POST'])
@require_kiosk_token
def start_cash_acceptance():
    """Enable coin and bill acceptors."""
    data = request.get_json() or {}
    try:
        target_amount = float(data.get('target_amount', 0))
        current_app.hardware.start_cash_acceptance(target_amount)
        return jsonify({'success': True})
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid target amount'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/cash/stop', methods=['POST'])
@require_kiosk_token
def stop_cash_acceptance():
    """Disable coin and bill acceptors."""
    try:
        current_app.hardware.stop_cash_acceptance()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/cash/debug', methods=['GET'])
@require_kiosk_token
def cash_debug():
    """Return cash acceptor state for hardware diagnostics."""
    try:
        return jsonify(current_app.hardware.get_cash_status())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/cash/insert', methods=['POST'])
@require_kiosk_token
def insert_cash():
    """Register browser function-key cash input for simulation and bench testing."""
    data = request.get_json() or {}
    amount = data.get('amount', 0)
    if amount not in (5, 10):
        return jsonify({'error': 'Invalid amount. Must be 5 (coin) or 10 (bill).'}), 400
    try:
        current_app.hardware.insert_cash(float(amount))
        return jsonify({'success': True, 'inserted': current_app.hardware.get_inserted_amount()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/cash/status', methods=['GET'])
@require_kiosk_token
def cash_status_stream():
    """Server-Sent Events stream for real-time cash insertion updates and diagnostics."""
    hw = current_app.hardware

    @stream_with_context
    def generate():
        while True:
            status = hw.get_cash_status()
            yield f"data: {json.dumps(status)}\n\n"

            time.sleep(0.3)

    return Response(generate(), mimetype='text/event-stream',
                    headers={
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'X-Accel-Buffering': 'no'
                    })


@hardware_bp.route('/change/dispense', methods=['POST'])
@require_kiosk_token
def dispense_change():
    """Trigger the change dispenser to dispense a specific amount in ₱5 coins.

    Expects JSON body: { "amount": 15.0 }
    Checks inventory balance before dispensing and deducts after successful dispensing.
    """
    from ..services.supabase_client import get_supabase
    from ..config import Config
    from datetime import datetime, timezone
    
    data = request.get_json() or {}
    try:
        amount = float(data.get('amount', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid amount'}), 400

    if amount <= 0:
        return jsonify({'success': True, 'coins': 0, 'message': 'No change to dispense'})

    coins = int(amount // 5)
    dispensing_amount = coins * 5
    remainder = amount - dispensing_amount

    # Check inventory balance before dispensing
    if dispensing_amount > 0:
        try:
            db = get_supabase()
            
            # Get device_id
            device_res = db.table('devices').select('device_id').eq('device_code', Config.KIOSK_ID).execute()
            if not device_res.data:
                return jsonify({'error': 'Device not found', 'insufficient_inventory': True}), 404
            
            device_id = device_res.data[0]['device_id']
            
            # Get current inventory balance
            inventory_res = db.table('device_inventory').select('change_amount').eq('device_id', device_id).execute()
            if not inventory_res.data:
                return jsonify({'error': 'Inventory not initialized', 'insufficient_inventory': True}), 404
            
            current_balance = float(inventory_res.data[0].get('change_amount', 0))
            
            # Check if sufficient inventory
            if current_balance < dispensing_amount:
                return jsonify({
                    'error': f'Insufficient inventory. Available: ₱{current_balance:.2f}, Required: ₱{dispensing_amount:.2f}',
                    'insufficient_inventory': True,
                    'available_balance': current_balance,
                    'required_amount': dispensing_amount,
                    'wallet_credit': amount  # Full amount goes to wallet
                }), 400
                
        except Exception as e:
            print(f"Inventory check error: {e}")
            return jsonify({'error': 'Inventory system unavailable', 'insufficient_inventory': True}), 500

    # Function to update inventory after successful dispensing
    def update_inventory_callback(coins_dispensed):
        if coins_dispensed > 0:
            dispensed_amount = coins_dispensed * 5
            try:
                db = get_supabase()
                device_res = db.table('devices').select('device_id').eq('device_code', Config.KIOSK_ID).execute()
                if device_res.data:
                    device_id = device_res.data[0]['device_id']
                    
                    # Get current balance and deduct dispensed amount
                    inventory_res = db.table('device_inventory').select('change_amount').eq('device_id', device_id).execute()
                    if inventory_res.data:
                        current_balance = float(inventory_res.data[0].get('change_amount', 0))
                        new_balance = max(0, current_balance - dispensed_amount)
                        
                        update_data = {
                            'change_amount': new_balance,
                            'updated_at': datetime.now(timezone.utc).isoformat()
                        }
                        
                        db.table('device_inventory').update(update_data).eq('device_id', device_id).execute()
                        print(f"Inventory updated: dispensed ₱{dispensed_amount:.2f}, new balance: ₱{new_balance:.2f}")
                        
            except Exception as e:
                print(f"Error updating inventory after dispensing: {e}")

    # Trigger dispenser with callback to update inventory
    current_app.hardware.dispense_change(amount, on_complete=update_inventory_callback)

    return jsonify({
        'success': True,
        'coins': coins,
        'dispensing': dispensing_amount,
        'wallet_credit': remainder,  # Any sub-₱5 remainder goes to wallet
        'message': f'Dispensing {coins} × ₱5 coin{"s" if coins != 1 else ""}'
    })
