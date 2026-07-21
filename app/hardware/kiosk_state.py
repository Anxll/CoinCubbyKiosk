import json
import os

STATE_FILE = "kiosk_state.json"

def get_coin_inventory() -> int:
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                state = json.load(f)
                return state.get('change_coins', 0)
    except Exception:
        pass
    return 0

def add_coin_inventory(coins: int) -> int:
    state = {}
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                state = json.load(f)
        except Exception:
            pass
    
    current = state.get('change_coins', 0)
    state['change_coins'] = current + coins
    
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(state, f)
    except Exception:
        pass
    return state['change_coins']

def deduct_coin_inventory(coins: int):
    state = {}
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                state = json.load(f)
        except Exception:
            pass
    
    current = state.get('change_coins', 0)
    state['change_coins'] = max(0, current - coins)
    
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(state, f)
    except Exception:
        pass
