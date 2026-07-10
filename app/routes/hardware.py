"""
Hardware control routes — door locks, printer, cash acceptors.
"""
from flask import Blueprint, request, jsonify, current_app, Response
import json
import time
import threading

hardware_bp = Blueprint('hardware', __name__)


@hardware_bp.route('/unlock/<compartment_code>', methods=['POST'])
def unlock_compartment(compartment_code):
    """Unlock a specific compartment door."""
    try:
        current_app.hardware.unlock_door(compartment_code)
        return jsonify({'success': True, 'message': f'Compartment {compartment_code} unlocked'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/door-status/<compartment_code>', methods=['GET'])
def door_status(compartment_code):
    """Check if a compartment door is open or closed."""
    try:
        is_open = current_app.hardware.get_door_status(compartment_code)
        return jsonify({'compartment': compartment_code, 'is_open': is_open})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/print-receipt', methods=['POST'])
def print_receipt():
    """Print a receipt via the thermal printer."""
    data = request.get_json()
    try:
        current_app.hardware.print_receipt(data)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/cash/start', methods=['POST'])
def start_cash_acceptance():
    """Enable coin and bill acceptors."""
    data = request.get_json() or {}
    target_amount = data.get('target_amount', 0)
    try:
        current_app.hardware.start_cash_acceptance(target_amount)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/cash/stop', methods=['POST'])
def stop_cash_acceptance():
    """Disable coin and bill acceptors."""
    try:
        current_app.hardware.stop_cash_acceptance()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hardware_bp.route('/cash/status', methods=['GET'])
def cash_status_stream():
    """Server-Sent Events stream for real-time cash insertion updates."""
    def generate():
        hw = current_app.hardware
        last_amount = -1

        while True:
            current_amount = hw.get_inserted_amount()
            if current_amount != last_amount:
                last_amount = current_amount
                data = json.dumps({
                    'inserted': current_amount,
                    'target': hw.cash_target,
                    'remaining': max(0, hw.cash_target - current_amount),
                    'complete': current_amount >= hw.cash_target
                })
                yield f"data: {data}\n\n"

                if current_amount >= hw.cash_target and hw.cash_target > 0:
                    break

            time.sleep(0.3)

    return Response(generate(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})
