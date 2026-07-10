"""
Thermal receipt printer driver using ESC/POS protocol.
Typically connected via USB.
"""
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def print_receipt(data: dict):
    """Print a formatted receipt using ESC/POS commands."""
    try:
        from escpos.printer import Usb

        # Common USB thermal printer vendor/product IDs
        # Adjust these for your specific printer model
        p = Usb(0x0416, 0x5011)  # Common POS printer IDs

        p.set(align='center', bold=True, width=2, height=2)
        p.text("COIN CUBBY\n")
        p.set(align='center', bold=False, width=1, height=1)
        p.text("Secure Storage Made Easy\n")
        p.text("================================\n")

        if data.get('type') == 'rental':
            p.set(align='center', bold=True)
            p.text("RENTAL CONFIRMATION\n")
            p.text("================================\n")
            p.set(align='left', bold=False)
            p.text(f"Compartment:  {data.get('compartment_code', 'N/A')}\n")
            p.text(f"Rental Type:  {data.get('rental_type', 'N/A')}\n")
            if data.get('duration'):
                p.text(f"Duration:     {data.get('duration')}\n")
            if data.get('expires_at'):
                p.text(f"Expires:      {data.get('expires_at')}\n")
            p.text("--------------------------------\n")
            p.set(bold=True)
            p.text(f"Total Paid:   P{data.get('total', 0):.2f}\n")
            p.text(f"Payment:      {data.get('payment_method', 'N/A').title()}\n")

        elif data.get('type') == 'retrieval':
            p.set(align='center', bold=True)
            p.text("RETRIEVAL RECEIPT\n")
            p.text("================================\n")
            p.set(align='left', bold=False)
            p.text(f"Compartment:  {data.get('compartment_code', 'N/A')}\n")
            p.text(f"Rental Type:  {data.get('rental_type', 'N/A')}\n")
            p.text(f"Start Time:   {data.get('started_at', 'N/A')}\n")
            p.text(f"End Time:     {datetime.now().strftime('%b %d, %Y %I:%M %p')}\n")
            p.text("--------------------------------\n")
            p.set(bold=True)
            p.text(f"Amount Due:   P{data.get('amount', 0):.2f}\n")

        p.text("================================\n")
        p.set(align='center', bold=False)
        p.text(f"Date: {datetime.now().strftime('%b %d, %Y %I:%M %p')}\n")
        p.text("Thank you for using Coin Cubby!\n")
        p.text("\n\n\n")
        p.cut()

    except ImportError:
        logger.error("python-escpos not available")
    except Exception as e:
        logger.error(f"Printer error: {e}")
