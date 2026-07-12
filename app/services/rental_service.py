"""
Rental business logic for pricing and overdue charges.
"""
from datetime import datetime, timezone


def calculate_fixed_rental_fee(hours: int, rate_per_hour: float) -> dict:
    """Calculate rental pricing directly from the Supabase rate."""
    rental_fee = hours * rate_per_hour
    return {
        'rental_fee': rental_fee,
        'total': rental_fee
    }


def calculate_open_time_charges(started_at_str: str, rate_per_hour: float) -> dict:
    """Calculate charges for an open-time rental based on elapsed time."""
    started_at = datetime.fromisoformat(started_at_str.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    elapsed = now - started_at
    elapsed_hours = max(1, int(elapsed.total_seconds() / 3600) + (1 if elapsed.total_seconds() % 3600 > 0 else 0))

    rental_fee = elapsed_hours * rate_per_hour
    return {
        'elapsed_hours': elapsed_hours,
        'rental_fee': rental_fee,
        'total': rental_fee
    }


def calculate_overdue_charges(expires_at_str: str, rate_per_hour: float) -> dict:
    """Calculate overdue charges for a fixed-duration rental that exceeded its time."""
    expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)

    if now <= expires_at:
        return {'overdue_hours': 0, 'overdue_fee': 0, 'total': 0}

    overdue = now - expires_at
    overdue_hours = max(1, int(overdue.total_seconds() / 3600) + (1 if overdue.total_seconds() % 3600 > 0 else 0))
    overdue_fee = overdue_hours * rate_per_hour

    return {
        'overdue_hours': overdue_hours,
        'overdue_fee': overdue_fee,
        'total': overdue_fee
    }
