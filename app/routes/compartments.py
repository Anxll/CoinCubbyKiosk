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
        
        # 1. Look up device_id based on DEVICE_CODE
        device_res = db.table('devices').select('device_id').eq('device_code', Config.DEVICE_CODE).execute()
        if not device_res.data:
            return jsonify({'error': 'Device not found in system'}), 404
        device_id = device_res.data[0]['device_id']
        
        # 2. Build locker query for this device
        query = db.table('lockers').select('''
            locker_id, locker_number, status, module_id, size_type_id,
            modules(name),
            storage_size_type(name)
        ''').eq('device_id', device_id).order('locker_number')
        
        result = query.execute()

        # 3. Filter by module if needed (client passes 'A' or 'B' etc, modules table has 'name' which is smallint in schema?)
        # Let's filter in python since modules.name is smallint but client sends A/B, maybe module id corresponds?
        # Assuming frontend logic will be updated if module format changes, or we map A=1, B=2.
        # Let's just return all and format them for the frontend.
        
        formatted_lockers = []
        for l in result.data:
            # Get the rate for this size type
            rate_res = db.table('rates').select('price_per_hour').eq('size_type_id', l['size_type_id']).execute()
            if not rate_res.data:
                return jsonify({'error': f'Rate not configured for size type {l["size_type_id"]}'}), 500
            price_per_hour = float(rate_res.data[0]['price_per_hour'])
            
            # Module name is a smallint (1, 2, etc.) — use it as-is
            mod_val = str(l['modules']['name']) if l['modules'] else '1'
            
            if module_name and mod_val != str(module_name):
                continue

            formatted_lockers.append({
                'id': l['locker_id'],
                'code': l['locker_number'],
                'module': mod_val,
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
        
        # 1. Get device id
        device_res = db.table('devices').select('device_id').eq('device_code', Config.DEVICE_CODE).execute()
        if not device_res.data:
             return jsonify({'error': 'Device not found'}), 404
        device_id = device_res.data[0]['device_id']
        
        # 2. Get locker
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
        
        mod_val = str(l['modules']['name']) if l['modules'] else '1'

        return jsonify({
            'compartment': {
                'id': l['locker_id'],
                'code': l['locker_number'],
                'module': mod_val,
                'size': l['storage_size_type']['name'].lower() if l['storage_size_type'] else 'unknown',
                'rate_per_hour': price_per_hour,
                'status': l['status'].lower()
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500
