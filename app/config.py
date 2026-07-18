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
