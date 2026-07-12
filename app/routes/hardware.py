"""
Hardware control routes — door locks, printer, cash acceptors.
"""
from flask import Blueprint, request, jsonify, current_app, Response, stream_with_context
import json
import time
from ..services.kiosk_security import require_kiosk_token

hardware_bp = Blueprint('hardware', __name__)


@hardware_bp.route('/unlock/<compartment_code>', methods=['POST'])
@require_kiosk_token
def unlock_compartment(compartment_code):
    """Unlock a specific compartment door."""
    try:
        current_app.hardware.unlock_door(compartment_code)
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
        current_app.hardware.print_receipt(data)
        return jsonify({'success': True})
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
