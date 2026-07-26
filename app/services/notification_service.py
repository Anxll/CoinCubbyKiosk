"""
Notification service — inserts rows into public.notifications (Supabase).

All public functions are fire-and-forget: they spawn a daemon thread so the
caller is never blocked by a database round-trip.

Notification types used by this service
───────────────────────────────────────
  'printer_no_paper'   – thermal printer timed-out; receipt paper likely empty
"""
import logging
import threading
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _insert(payload: dict) -> None:
    """Worker: runs in a background thread to avoid blocking the caller."""
    try:
        from .supabase_client import get_supabase
        db = get_supabase()
        db.table('notifications').insert(payload).execute()
        logger.info(
            "[NOTIFICATION] Inserted '%s' — %s",
            payload.get('type'), payload.get('title'),
        )
    except Exception as exc:
        # Never let a notification failure crash anything else.
        logger.error("[NOTIFICATION] Failed to insert notification: %s", exc)


def _fire(payload: dict) -> None:
    """Dispatch payload insertion on a daemon thread."""
    t = threading.Thread(target=_insert, args=(payload,), daemon=True)
    t.start()


# ── Public helpers ────────────────────────────────────────────────────────────

def notify_no_receipt_paper(kiosk_id: str = 'unknown') -> None:
    """Create a high-priority notification when the thermal printer times out.

    Args:
        kiosk_id: The KIOSK_ID from config, used to identify which unit.
    """
    _fire({
        'type':          'printer_no_paper',
        'title':         '🖨️ No Receipt Paper',
        'message': (
            f"Kiosk '{kiosk_id}' could not print a receipt — the thermal "
            "printer timed out. Receipt paper may be empty or the paper roll "
            "needs to be reloaded."
        ),
        'priority':      'high',
        'is_read':       False,
        'created_at':    datetime.now(timezone.utc).isoformat(),
    })
