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


def _notify_admin_out_of_paper():
    """Send a notification to the admin dashboard via Supabase."""
    try:
        from ..services.supabase_client import get_supabase
        db = get_supabase()
        db.table('notifications').insert({
            'type': 'hardware_error',
            'title': 'Printer Out of Paper',
            'message': 'The kiosk thermal printer has run out of paper and needs to be refilled.',
            'priority': 'urgent'
        }).execute()
        logger.info("Admin notification sent regarding out of paper status.")
    except Exception as e:
        logger.error(f"Failed to send admin notification: {e}")


def print_receipt(data: dict):
    """Print a formatted receipt using ESC/POS commands."""
    p = None
    try:
        from escpos.printer import Usb

        # timeout=2000 prevents blocking forever if the printer is stuck or out of paper
        p = Usb(VENDOR_ID, PRODUCT_ID, profile=PROFILE, timeout=2000)

        # Check paper status if supported by the printer firmware
        try:
            if hasattr(p, 'paper_status'):
                status = p.paper_status()
                # 1 or 2 usually indicates paper near-end or out in ESC/POS
                if status in (1, 2):
                    logger.error("Thermal printer is OUT OF PAPER.")
                    _notify_admin_out_of_paper()
                    raise RuntimeError("Printer is out of thermal paper. Please notify staff.")
        except RuntimeError:
            raise # Re-raise the out-of-paper error directly
        except Exception as status_err:
            logger.warning(f"Could not query paper status (might not be supported by this model): {status_err}")

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
            p.text(f"Rental Type:  {data.get('rental_type', 'N/A')}\n")
            if data.get('duration'):
                p.text(f"Duration:     {data.get('duration')}\n")
            if data.get('expires_at'):
                p.text(f"Expires:  {data.get('expires_at')}\n")
            p.text("--------------------------------\n")
            p.set(bold=True)
            total = float(data.get('total', 0))
            p.text(f"Amount Due:   P{total:.2f}\n")
            p.set(bold=False)
            
            payment_method = str(data.get('payment_method', 'N/A')).title()
            p.text(f"Payment:      {payment_method}\n")
            
            if payment_method.lower() == 'cash':
                cash_inserted = float(data.get('cash_inserted', total))
                change = cash_inserted - total
                p.text(f"Amount Paid:  P{cash_inserted:.2f}\n")
                if change > 0:
                    p.text(f"Change:       P{change:.2f}\n")
                    
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
            p.text(f"Rental Type:  {data.get('rental_type', 'N/A')}\n")
            p.text(f"Start Time:   {data.get('started_at', 'N/A')}\n")
            p.text(f"End Time:     {datetime.now().strftime('%b %d, %Y %I:%M %p')}\n")
            p.text("--------------------------------\n")
            p.set(bold=True)
            amount = float(data.get('amount', 0))
            p.text(f"Amount Due:   P{amount:.2f}\n")
            p.set(bold=False)
            
            payment_method = str(data.get('payment_method', 'N/A')).title()
            if data.get('payment_method'):
                p.text(f"Payment:      {payment_method}\n")
                
            if payment_method.lower() == 'cash' and amount > 0:
                cash_inserted = float(data.get('cash_inserted', amount))
                change = cash_inserted - amount
                p.text(f"Amount Paid:  P{cash_inserted:.2f}\n")
                if change > 0:
                    p.text(f"Change:       P{change:.2f}\n")

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
        err_msg = "python-escpos is not installed. Cannot print receipt."
        logger.error(err_msg)
        raise RuntimeError(err_msg)
    except Exception as e:
        logger.error(f"Printer error: {e}")
        # Re-raise the exception so the HTTP endpoint can catch it and return a 500 error to the frontend
        raise e
    finally:
        # CRITICAL: Always close the USB connection to release the resource.
        # Without this, the next print will fail with 'Resource busy'.
        if p is not None:
            try:
                p.close()
            except Exception:
                pass
