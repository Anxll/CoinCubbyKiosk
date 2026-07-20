"""
Rental business logic for pricing and overdue charges.

Billing rules
─────────────
Fixed Duration  : hours × rate_per_hour  (prepaid, no grace)

Open Hour       : charged in 30-min steps, no free time
                  Each 30-min block = rate_per_hour / 2
                  e.g. at ₱15/hr:
                    1–30 min  → ₱7.50  (1 block)
                    31–60 min → ₱15.00 (2 blocks)

Overtime        : charged in 30-min steps with a 10-min grace period
                  at the START of every block
                  Each charged block = rate_per_hour / 2
                  e.g. at ₱15/hr:
                    0–10 min  → ₱0     (grace, block 1)
                    11–30 min → ₱7.50  (block 1 charged)
                    31–40 min → ₱7.50  (grace, block 2 — total unchanged)
                    41–60 min → ₱15.00 (block 2 charged)
"""
import math
from datetime import datetime, timezone


def calculate_fixed_rental_fee(hours: int, rate_per_hour: float) -> dict:
    """Calculate prepaid fixed-duration rental fee from the database rate."""
    rental_fee = hours * rate_per_hour
    return {
        'rental_fee': rental_fee,
        'total': rental_fee
    }


def calculate_open_time_charges(started_at_str: str, rate_per_hour: float) -> dict:
    """
    Calculate charges for an open-time rental.

    Billing: 30-minute blocks, each block = rate_per_hour / 2.
    Minimum charge: 1 block (even for < 30 min elapsed).
    """
    started_at = datetime.fromisoformat(started_at_str.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    elapsed_minutes = (now - started_at).total_seconds() / 60

    # At least 1 block; round any partial block up to the next full block
    blocks = max(1, math.ceil(elapsed_minutes / 30))
    total = blocks * (rate_per_hour / 2)

    return {
        'elapsed_hours': round(elapsed_minutes / 60, 4),
        'rental_fee': total,
        'total': total
    }


def calculate_overdue_charges(expires_at_str: str, rate_per_hour: float) -> dict:
    """
    Calculate overdue charges for a fixed-duration rental that exceeded its time.

    Billing: 30-minute blocks with a 10-minute free grace period at the
    start of each block.

    charged_blocks = ceil((overdue_minutes - 10) / 30)  when overdue > 10 min
                   = 0                                   when overdue ≤ 10 min
    Each charged block = rate_per_hour / 2.
    """
    expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)

    if now <= expires_at:
        return {'overdue_hours': 0, 'overdue_fee': 0, 'total': 0}

    overdue_minutes = (now - expires_at).total_seconds() / 60

    if overdue_minutes <= 10:
        # Still within the first grace period — no charge yet
        charged_blocks = 0
    else:
        # Each subsequent 30-min block also has a 10-min grace at its start,
        # so we subtract 10 min and ceil the remainder in 30-min steps.
        charged_blocks = math.ceil((overdue_minutes - 10) / 30)

    overdue_fee = charged_blocks * (rate_per_hour / 2)

    return {
        'overdue_hours': round(overdue_minutes / 60, 4),
        'overdue_fee': overdue_fee,
        'total': overdue_fee
    }
