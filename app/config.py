"""
Application configuration loaded from environment variables.
"""
import os
import secrets
from dotenv import load_dotenv

load_dotenv()


def _optional_int(name: str):
    value = os.getenv(name, '').strip()
    return int(value) if value else None


def _optional_float(name: str, default: float):
    value = os.getenv(name, '').strip()
    return float(value) if value else default


class Config:
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
    DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

    # Supabase
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')
    KIOSK_API_TOKEN = os.getenv('KIOSK_API_TOKEN') or secrets.token_hex(32)

    # Hardware
    SIMULATION_MODE = os.getenv('SIMULATION_MODE', 'false').lower() == 'true'
    KIOSK_ID = os.getenv('KIOSK_ID', 'kiosk-001')
    DEVICE_CODE = os.getenv('DEVICE_CODE', 'KIOSK-001')

    # GPIO Pins (BCM numbering)
    COIN_ACCEPTOR_PIN = int(os.getenv('COIN_ACCEPTOR_PIN', '17'))
    COIN_ACCEPTOR_ENABLE_PIN = _optional_int('COIN_ACCEPTOR_ENABLE_PIN')
    COIN_ACCEPTOR_PULSE_VALUE = _optional_float('COIN_ACCEPTOR_PULSE_VALUE', 5.0)
    COIN_ACCEPTOR_BOUNCETIME_MS = int(os.getenv('COIN_ACCEPTOR_BOUNCETIME_MS', '30'))
    BILL_ACCEPTOR_PIN = int(os.getenv('BILL_ACCEPTOR_PIN', '27'))
    BILL_ACCEPTOR_ENABLE_PIN = _optional_int('BILL_ACCEPTOR_ENABLE_PIN')
    BILL_ACCEPTOR_PULSE_VALUE = _optional_float('BILL_ACCEPTOR_PULSE_VALUE', 10.0)
    BILL_ACCEPTOR_BOUNCETIME_MS = int(os.getenv('BILL_ACCEPTOR_BOUNCETIME_MS', '10'))
    DOOR_LOCK_PINS = [int(p) for p in os.getenv('DOOR_LOCK_PINS', '5,6,13,19,26,16,20,21').split(',')]
    DOOR_SENSOR_PINS = [int(p) for p in os.getenv('DOOR_SENSOR_PINS', '4,22,23,24,25,12,7,8').split(',')]

    # Compartment Configuration
    MODULES = ['A', 'B']
    COMPARTMENTS_PER_MODULE = 4  # 2 Small, 1 Medium, 1 Large

    # Pricing
    SERVICE_FEE = 5.00
    MAX_RENTALS_PER_USER = 3
    FIXED_DURATION_TIERS = [
        {'label': '1 Hour', 'hours': 1, 'price': 10},
        {'label': '3 Hours', 'hours': 3, 'price': 25},
        {'label': '6 Hours', 'hours': 6, 'price': 45},
        {'label': '12 Hours', 'hours': 12, 'price': 65},
        {'label': '1 Day', 'hours': 24, 'price': 80},
        {'label': '2 Days', 'hours': 48, 'price': 140},
        {'label': '3 Days', 'hours': 72, 'price': 190},
    ]
    RATE_PER_HOUR = 10.00
