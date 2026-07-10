import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.services.supabase_client import get_supabase

def test():
    db = get_supabase()
    res = db.table('devices').select('*').execute()
    print("All Devices:", res.data)

if __name__ == '__main__':
    test()
