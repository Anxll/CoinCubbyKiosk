"""
Application configuration loaded from environment variables.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
    DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

    # Supabase
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')

    # Hardware
    SIMULATION_MODE = os.getenv('SIMULATION_MODE', 'true').lower() == 'true'
    KIOSK_ID = os.getenv('KIOSK_ID', 'kiosk-001')
    DEVICE_CODE = os.getenv('DEVICE_CODE', 'KIOSK-001')

    # GPIO Pins (BCM numbering)
    COIN_ACCEPTOR_PIN = int(os.getenv('COIN_ACCEPTOR_PIN', '17'))
    BILL_ACCEPTOR_PIN = int(os.getenv('BILL_ACCEPTOR_PIN', '27'))
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
