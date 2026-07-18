"""
Compartment listing and status routes.
"""
from flask import Blueprint, request, jsonify, current_app
from ..services.supabase_client import get_supabase
from ..config import Config
from ..services.kiosk_security import require_kiosk_token

compartments_bp = Blueprint('compartments', __name__)


@compartments_bp.route('/', methods=['GET'])
@require_kiosk_token
def list_compartments():
    """List all lockers for this specific kiosk device, optionally filtered by module."""
    module_name = request.args.get('module')

    try:
        db = get_supabase()
        
        # 1. Look up device_id based on KIOSK_ID matching the device_code column
        device_res = db.table('devices').select('device_id').eq('device_code', Config.KIOSK_ID).execute()
        if not device_res.data:
            return jsonify({'error': 'Device not found in system', 'code': Config.KIOSK_ID}), 401
        device_id = device_res.data[0]['device_id']
        
        # 2. Build locker query — use module_id for the 16-char CAN bus identity
        query = db.table('lockers').select('''
            locker_id, locker_number, status, module_id, size_type_id,
            modules(name),
            storage_size_type(name)
        ''').eq('device_id', device_id).order('locker_number')
        
        result = query.execute()

        formatted_lockers = []
        for l in result.data:
            # Get the rate for this size type
            rate_res = db.table('rates').select('price_per_hour').eq('size_type_id', l['size_type_id']).execute()
            if not rate_res.data:
                return jsonify({'error': f'Rate not configured for size type {l["size_type_id"]}'}), 500
            price_per_hour = float(rate_res.data[0]['price_per_hour'])
            
            mod = l['modules'] or {}
            mod_val = str(mod.get('name', '1'))
            
            if module_name and mod_val != str(module_name):
                continue

            formatted_lockers.append({
                'id': l['locker_id'],
                'code': l['locker_number'],
                'module': mod_val,
                'device_code': l.get('module_id', ''),  # 16-char CAN bus module ID
                'size': l['storage_size_type']['name'].lower() if l['storage_size_type'] else 'unknown',
                'rate_per_hour': price_per_hour,
                'status': l['status'].lower()
            })

        return jsonify({'compartments': formatted_lockers})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@compartments_bp.route('/<code>', methods=['GET'])
@require_kiosk_token
def get_compartment(code):
    """Get a single locker by its code."""
    try:
        db = get_supabase()
        
        # 1. Get device id from KIOSK_ID matching the device_code column
        device_res = db.table('devices').select('device_id').eq('device_code', Config.KIOSK_ID).execute()
        if not device_res.data:
             return jsonify({'error': 'Device not found'}), 404
        device_id = device_res.data[0]['device_id']
        
        # 2. Get locker — use module_id for the CAN bus identity
        result = db.table('lockers').select('''
            locker_id, locker_number, status, module_id, size_type_id,
            modules(name),
            storage_size_type(name)
        ''').eq('device_id', device_id).eq('locker_number', code.upper()).execute()

        if not result.data:
            return jsonify({'error': 'Compartment not found'}), 404

        l = result.data[0]
        
        rate_res = db.table('rates').select('price_per_hour').eq('size_type_id', l['size_type_id']).execute()
        if not rate_res.data:
            return jsonify({'error': f'Rate not configured for size type {l["size_type_id"]}'}), 500
        price_per_hour = float(rate_res.data[0]['price_per_hour'])
        
        mod = l['modules'] or {}
        mod_val = str(mod.get('name', '1'))

        return jsonify({
            'compartment': {
                'id': l['locker_id'],
                'code': l['locker_number'],
                'module': mod_val,
                'device_code': l.get('module_id', ''),  # 16-char CAN bus module ID
                'size': l['storage_size_type']['name'].lower() if l['storage_size_type'] else 'unknown',
                'rate_per_hour': price_per_hour,
                'status': l['status'].lower()
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
