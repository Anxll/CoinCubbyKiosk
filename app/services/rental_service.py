"""
Rental business logic — pricing calculations, duration exceeded charges, etc.
"""
from datetime import datetime, timezone
from ..config import Config


def calculate_fixed_rental_fee(hours: int, rate_per_hour: float) -> dict:
    """Find the matching fixed duration tier and return pricing."""
    # Assuming tiers scale based on rate_per_hour (or use Config's base multipliers)
    # The original was: 1h=10, 3h=25, 6h=45. (Slightly discounted).
    # Since rate is dynamic now from the DB, we can just calculate it with a small discount.
    # Or just use the exact hours * rate_per_hour for simplicity.
    
    # Simple straight calculation:
    rental_fee = hours * rate_per_hour
    
    # Apply standard discount pattern if desired, but for now straight multiplication is safer
    if hours == 3: rental_fee *= 0.9
    elif hours == 6: rental_fee *= 0.85
    elif hours == 12: rental_fee *= 0.80
    elif hours == 24: rental_fee *= 0.75
    elif hours == 48: rental_fee *= 0.70
    elif hours == 72: rental_fee *= 0.65
    
    return {
        'rental_fee': rental_fee,
        'service_fee': Config.SERVICE_FEE,
        'total': rental_fee + Config.SERVICE_FEE
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
        'service_fee': Config.SERVICE_FEE,
        'total': rental_fee + Config.SERVICE_FEE
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
