"""
Thermal receipt printer driver using ESC/POS protocol (python-escpos).
Printer: POS-5890 connected via USB (Vendor: 0x0483, Product: 0x70b)

IMPORTANT: Always call p.close() after printing or the USB resource will
           be locked, causing a 'Resource busy' error on the next print.
"""
import logging
from datetime import datetime
import os

logger = logging.getLogger(__name__)

# Printer USB identifiers — confirmed working on POS-5890
VENDOR_ID  = 0x0483
PRODUCT_ID = 0x070b
PROFILE    = 'POS-5890'


def print_receipt(data: dict):
    """Print a formatted receipt using ESC/POS commands."""
    p = None
    try:
        from escpos.printer import Usb

        p = Usb(VENDOR_ID, PRODUCT_ID, profile=PROFILE)

        # ── Header ────────────────────────────────────────────────
        logo_path = os.path.join('static', 'images', 'logo.png')
        logger.info(f"Looking for logo at: {logo_path}")
        if os.path.exists(logo_path):
            p.set(align='center')
            try:
                from PIL import Image
                img = Image.open(logo_path)
                logger.info(f"Logo loaded: {img.size}, mode={img.mode}")
                p.image(img, center=True)

                logger.info("Logo printed successfully")
            except ImportError:
                logger.error("Pillow (PIL) is not installed. Run: pip install Pillow")
            except Exception as e:
                logger.error(f"Failed to print logo: {e}", exc_info=True)
        else:
            logger.warning(f"Logo not found at: {logo_path}")

        p.set(align='center', bold=True, width=2, height=2)
        p.text("COIN CUBBY\n")
        p.set(align='center', bold=False, width=1, height=1)
        p.text("Secure Storage Made Easy\n")
        p.text("================================\n")

        # ── Rental Receipt ────────────────────────────────────────
        if data.get('type') == 'rental':
            p.set(align='center', bold=True)
            p.text("RENTAL CONFIRMATION\n")
            p.text("================================\n")
            p.set(align='left', bold=False)
            p.text(f"Compartment:  {data.get('compartment_code', 'N/A')}\n")
            if data.get('module'):
                p.text(f"Module:       {data.get('module')}\n")
            if data.get('locker_name'):
                p.text(f"Locker:       {data.get('locker_name')}\n")
            p.text(f"Rental Type:  {data.get('rental_type', 'N/A')}\n")
            if data.get('duration'):
                p.text(f"Duration:     {data.get('duration')}\n")
            if data.get('expires_at'):
                p.text(f"Expires:  {data.get('expires_at')}\n")
            p.text("--------------------------------\n")
            p.set(bold=True)
            p.text(f"Total Paid:   P{float(data.get('total', 0)):.2f}\n")
            p.set(bold=False)
            p.text(f"Payment:      {str(data.get('payment_method', 'N/A')).title()}\n")
            if data.get('wallet_credit') and float(data.get('wallet_credit', 0)) > 0:
                p.text(f"Wallet Credit:P{float(data.get('wallet_credit', 0)):.2f}\n")

        # ── Retrieval Receipt ─────────────────────────────────────
        elif data.get('type') == 'retrieval':
            p.set(align='center', bold=True)
            p.text("RETRIEVAL RECEIPT\n")
            p.text("================================\n")
            p.set(align='left', bold=False)
            p.text(f"Compartment:  {data.get('compartment_code', 'N/A')}\n")
            if data.get('module'):
                p.text(f"Module:       {data.get('module')}\n")
            if data.get('locker_name'):
                p.text(f"Locker:       {data.get('locker_name')}\n")
            p.text(f"Rental Type:  {data.get('rental_type', 'N/A')}\n")
            p.text(f"Start Time:   {data.get('started_at', 'N/A')}\n")
            p.text(f"End Time:     {datetime.now().strftime('%b %d, %Y %I:%M %p')}\n")
            p.text("--------------------------------\n")
            p.set(bold=True)
            p.text(f"Amount Due:   P{float(data.get('amount', 0)):.2f}\n")
            p.set(bold=False)
            if data.get('payment_method'):
                p.text(f"Payment:      {str(data.get('payment_method', 'N/A')).title()}\n")

        # ── Footer ────────────────────────────────────────────────
        p.text("================================\n")
        p.set(align='center', bold=False)
        p.text(f"Date: {datetime.now().strftime('%b %d, %Y %I:%M %p')}\n")
        p.text("Thank you for using Coin Cubby!\n")
        
        # QR Code for feedback
        p.set(align='center')
        p.qr("https://coincubby.vercel.app/#/feedback", size=6, center=True)
        
        # Use a smaller font (font='b') so the long text fits on one line
        p.set(align='center', font='b')
        p.text("Please tell us about your experience!\n")
        p.text("\n\n\n")
        p.cut()

        logger.info(f"Receipt printed successfully (type={data.get('type')})")

    except ImportError:
        logger.error("python-escpos is not installed. Cannot print receipt.")
    except Exception as e:
        logger.error(f"Printer error: {e}")
    finally:
        # CRITICAL: Always close the USB connection to release the resource.
        # Without this, the next print will fail with 'Resource busy'.
        if p is not None:
            try:
                p.close()
            except Exception:
                pass
