"""
Thermal receipt printer driver using ESC/POS protocol (python-escpos).
Printer: POS-5890 connected via USB (Vendor: 0x0483, Product: 0x70b)

IMPORTANT: Always call p.close() after printing or the USB resource will
           be locked, causing a 'Resource busy' error on the next print.

Receipt data contract
─────────────────────
Both 'rental' and 'retrieval' receipts receive the following payment fields:

    amount_due    – what the customer owed
    amount_paid   – gross cash inserted (= amount_due for wallet / exact cash)
    change_amount – gross overpayment (amount_paid - amount_due), 0 if none
    wallet_credit – portion of change_amount credited to wallet by backend
                    (change_amount - wallet_credit) = coins physically dispensed
    refund_amount – early-retrieval wallet refund (retrieval only)
    payment_method – 'wallet' | 'cash' | 'None'
"""
import logging
from datetime import datetime
import os
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

logger = logging.getLogger(__name__)

# How long (seconds) to wait for the printer before giving up.
# The thermal printer blocks indefinitely when there is no paper, so we
# must enforce our own deadline.
PRINT_TIMEOUT_SECONDS = 5


class PrinterTimeoutError(Exception):
    """Raised when the printer does not respond within PRINT_TIMEOUT_SECONDS."""
    pass

# Printer USB identifiers — confirmed working on POS-5890
VENDOR_ID  = 0x0483
PRODUCT_ID = 0x070b
PROFILE    = 'POS-5890'

# Receipt width for separator lines (58 mm paper → ~32 chars at normal size)
SEP  = "================================"
DASH = "--------------------------------"


def _fmt(amount: float) -> str:
    """Format a peso amount with symbol."""
    return f"P{amount:.2f}"


def _row(label: str, value: str, width: int = 32) -> str:
    """Left-pad label and right-align value in a fixed-width row."""
    gap = width - len(label) - len(value)
    return label + (" " * max(1, gap)) + value + "\n"


def print_receipt(data: dict):
    """Print a formatted receipt using ESC/POS commands.

    Runs the actual USB/ESC-POS work in a background thread with a hard
    deadline of PRINT_TIMEOUT_SECONDS.  If the printer blocks (e.g. out
    of paper) the thread is abandoned and a PrinterTimeoutError is raised
    so the caller can inform the user.
    """
    # Use a single-thread executor so we can impose a timeout on the
    # blocking USB write without killing the whole process.
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_do_print_receipt, data)
        try:
            future.result(timeout=PRINT_TIMEOUT_SECONDS)
        except FutureTimeoutError:
            future.cancel()
            logger.error(
                "[THERMAL_PRINTER] Timed out after %ds — printer may be out of paper.",
                PRINT_TIMEOUT_SECONDS,
            )
            raise PrinterTimeoutError(
                f"Printer did not respond within {PRINT_TIMEOUT_SECONDS}s. "
                "Please check that receipt paper is loaded."
            )


def _do_print_receipt(data: dict):
    """Internal: blocking ESC/POS print — called from a worker thread."""
    logger.info(f"[THERMAL_PRINTER] Receipt data received: {data}")

    p = None
    try:
        from escpos.printer import Usb

        p = Usb(VENDOR_ID, PRODUCT_ID, profile=PROFILE)

        # ── Helpers scoped to this printer instance ────────────────
        def header():
            logo_path = os.path.join('static', 'images', 'logo.png')
            if os.path.exists(logo_path):
                p.set(align='center')
                try:
                    from PIL import Image
                    p.image(Image.open(logo_path), center=True)
                except Exception as e:
                    logger.error(f"Logo print failed: {e}")

            p.set(align='center', bold=True, width=2, height=2)
            p.text("COIN CUBBY\n")
            p.set(align='center', bold=False, width=1, height=1)
            p.text("Secure Storage Made Easy\n")
            p.text(f"{SEP}\n")

        def footer():
            p.text(f"{SEP}\n")
            p.set(align='center', bold=False)
            p.text(f"Date: {datetime.now().strftime('%b %d, %Y %I:%M %p')}\n")
            p.text("Thank you for using Coin Cubby!\n")
            p.set(align='center')
            p.qr("https://coincubby.vercel.app/#/feedback", size=6, center=True)
            p.set(align='center', font='b')
            p.text("Please tell us about your experience!\n")
            p.text("\n\n\n")
            p.cut()

        def payment_block(amount_due, amount_paid, change_amount,
                          wallet_credit, payment_method, refund_amount=0):
            """
            Print the PAYMENT DETAILS block.

            Handles four scenarios:
              1. Wallet payment       – deducted from balance, no change
              2. Cash exact           – no change
              3. Cash + change→wallet – overpayment credited to wallet
              4. Cash + coins         – coins dispensed; remainder (if any) to wallet
            """
            coins_dispensed = max(0.0, round(change_amount - wallet_credit, 2))

            p.set(align='center', bold=True)
            p.text("PAYMENT DETAILS\n")
            p.set(align='left', bold=False)
            p.text(f"{DASH}\n")

            p.text(_row("Amount Due:",  _fmt(amount_due)))
            p.text(_row("Amount Paid:", _fmt(amount_paid)))
            p.text(_row("Method:",      str(payment_method).title()))

            if change_amount > 0:
                p.text(f"{DASH}\n")
                p.text(_row("Change:",  _fmt(change_amount)))
                if coins_dispensed > 0:
                    p.text(_row("  Coins:",  _fmt(coins_dispensed)))
                if wallet_credit > 0:
                    p.text(_row("  -> Wallet:", _fmt(wallet_credit)))
            elif wallet_credit > 0:
                p.text(f"{DASH}\n")
                # Wallet credit without physical change (shouldn't normally occur
                # but acts as a safety fallback)
                p.text(_row("Wallet Credit:", _fmt(wallet_credit)))

            if refund_amount > 0:
                p.text(f"{DASH}\n")
                p.text("** EARLY RETRIEVAL REFUND **\n")
                p.text(_row("Refunded -> Wallet:", _fmt(refund_amount)))

            p.text(f"{DASH}\n")

        # ── Rental Receipt ─────────────────────────────────────────
        if data.get('type') == 'rental':
            header()

            p.set(align='center', bold=True)
            p.text("RENTAL CONFIRMATION\n")
            p.text(f"{SEP}\n")

            p.set(align='left', bold=False)
            if data.get('module'):
                p.text(_row("Module:", data.get('module', 'N/A')))
            p.text(_row("Compartment:", data.get('compartment_code', 'N/A')))
            p.text(_row("Type:", data.get('rental_type', 'N/A')))
            if data.get('duration'):
                p.text(_row("Duration:", data.get('duration')))
            if data.get('expires_at'):
                p.text(_row("Expires:", data.get('expires_at')))

            p.text(f"{DASH}\n")

            amount_due    = float(data.get('amount_due', 0) or data.get('total', 0))
            amount_paid   = float(data.get('amount_paid', 0) or amount_due)
            change_amount = float(data.get('change_amount', 0))
            wallet_credit = float(data.get('wallet_credit', 0))
            method        = data.get('payment_method', 'N/A')

            payment_block(amount_due, amount_paid, change_amount,
                          wallet_credit, method)

            footer()

        # ── Retrieval Receipt ──────────────────────────────────────
        elif data.get('type') == 'retrieval':
            header()

            p.set(align='center', bold=True)
            p.text("RETRIEVAL RECEIPT\n")
            p.text(f"{SEP}\n")

            p.set(align='left', bold=False)
            if data.get('module'):
                p.text(_row("Module:", data.get('module', 'N/A')))
            p.text(_row("Compartment:", data.get('compartment_code', 'N/A')))
            p.text(_row("Type:", data.get('rental_type', 'N/A')))
            if data.get('started_at'):
                p.text(_row("Started:", str(data.get('started_at'))))
            p.text(_row("Retrieved:", datetime.now().strftime('%b %d, %Y %I:%M %p')))

            p.text(f"{DASH}\n")

            amount_due    = float(data.get('amount_due', 0) or data.get('amount', 0))
            amount_paid   = float(data.get('amount_paid', 0) or amount_due)
            change_amount = float(data.get('change_amount', 0))
            wallet_credit = float(data.get('wallet_credit', 0))
            refund_amount = float(data.get('refund_amount', 0))
            method        = data.get('payment_method', 'None')

            if amount_due > 0 or refund_amount > 0:
                payment_block(amount_due, amount_paid, change_amount,
                              wallet_credit, method, refund_amount)
            else:
                # Free retrieval (open-time already paid, no overdue)
                p.set(align='left', bold=False)
                p.text("PAYMENT DETAILS\n")
                p.text(f"{DASH}\n")
                p.text(_row("Amount Due:", _fmt(0)))
                p.text(_row("Status:", "No charge"))
                p.text(f"{DASH}\n")

            footer()

        logger.info(f"Receipt printed successfully (type={data.get('type')})")

    except ImportError:
        logger.error("python-escpos is not installed. Cannot print receipt.")
    except Exception as e:
        logger.error(f"Printer error: {e}", exc_info=True)
    finally:
        # CRITICAL: Always close the USB connection to release the resource.
        # Without this, the next print will fail with 'Resource busy'.
        if p is not None:
            try:
                p.close()
            except Exception:
                pass
