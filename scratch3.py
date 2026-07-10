import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.services.supabase_client import get_supabase

def test():
    db = get_supabase()
    query = db.table('lockers').select('locker_number, status, modules(name), storage_size_type(name)').eq('device_id', 1).execute()
    print("Lockers for Device 1:")
    for row in query.data:
        print(row)

if __name__ == '__main__':
    test()
