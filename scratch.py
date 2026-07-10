import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.services.supabase_client import get_supabase
from app.config import Config

def test():
    db = get_supabase()
    device_res = db.table('devices').select('device_id').eq('device_code', Config.DEVICE_CODE).execute()
    print("Device:", device_res.data)
    if device_res.data:
        device_id = device_res.data[0]['device_id']
        query = db.table('lockers').select('locker_number, modules(name)').eq('device_id', device_id).execute()
        print("Lockers:", query.data)

if __name__ == '__main__':
    test()
