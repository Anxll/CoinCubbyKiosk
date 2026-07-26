"""
Hardware simulator for development on non-Pi systems.
Simulates coin/bill insertion, door locks, and thermal printing.
"""
import logging
import threading
import time

logger = logging.getLogger(__name__)


class HardwareSimulator:
    """Simulates all hardware peripherals for development."""

    def __init__(self, manager):
        self.manager = manager
        self._inserted_amount = 0
        self._simulation_thread = None
        self._simulating = False
        self._door_states = {}  # compartment_code: bool (True = open)

    def unlock_door(self, compartment_code: str):
        """Simulate door unlock."""
        logger.info(f"[SIM] 🔓 Door unlocked: {compartment_code}")
        self._door_states[compartment_code] = True

        def auto_close():
            time.sleep(5)
            self._door_states[compartment_code] = False
            logger.info(f"[SIM] 🔒 Door auto-locked: {compartment_code}")

        threading.Thread(target=auto_close, daemon=True).start()

    def get_door_status(self, compartment_code: str) -> bool:
        return self._door_states.get(compartment_code, False)

    def start_cash_simulation(self, target_amount: float):
        """Start simulated cash acceptance; waits for browser function-key test input."""
        self._inserted_amount = 0
        self._simulating = True
        logger.info(f"[SIM] Cash acceptance started. Target: ₱{target_amount}. Use F13/F8 for bill or F14/F9 for coin.")

    def insert_cash(self, amount: float):
        """Manually insert simulated cash from browser function-key test input."""
        if self._simulating:
            self._inserted_amount += amount
            label = "💵 Bill" if amount == 10 else "🪙 Coin"
            logger.info(f"[SIM] {label} inserted: ₱{amount} (Total: ₱{self._inserted_amount})")

    def stop_cash_simulation(self):
        self._simulating = False

    def get_inserted_amount(self) -> float:
        return self._inserted_amount

    def print_receipt(self, data: dict):
        """Simulate receipt printing to console."""
        logger.info(f"[SIM] 🖨️  Receipt data received: {data}")
        logger.info("[SIM] 🖨️  ==================== RECEIPT ====================")
        logger.info(f"[SIM] 🖨️  COIN CUBBY - Secure Storage Made Easy")
        logger.info(f"[SIM] 🖨️  ================================================")

        if data.get('type') == 'rental':
            logger.info(f"[SIM] 🖨️  RENTAL CONFIRMATION")
            logger.info(f"[SIM] 🖨️  ================================")
            if data.get('module'):
                logger.info(f"[SIM] 🖨️  Module:       {data.get('module')}")
            logger.info(f"[SIM] 🖨️  Compartment:  {data.get('compartment_code', 'N/A')}")
            logger.info(f"[SIM] 🖨️  Rental Type:  {data.get('rental_type', 'N/A')}")
            if data.get('duration'):
                logger.info(f"[SIM] 🖨️  Duration:     {data.get('duration')}")
            if data.get('expires_at'):
                logger.info(f"[SIM] 🖨️  Expires:      {data.get('expires_at')}")
            logger.info(f"[SIM] 🖨️  --------------------------------")
            logger.info(f"[SIM] 🖨️  PAYMENT DETAILS")
            
            # Enhanced debugging for amounts
            amount_due = float(data.get('amount_due', 0))
            amount_paid = float(data.get('amount_paid', 0))  
            total_paid = float(data.get('total', 0))
            change_amount = float(data.get('change_amount', 0))
            wallet_credit = float(data.get('wallet_credit', 0))
            
            logger.info(f"[SIM] 🖨️  DEBUG: amount_due={amount_due}, amount_paid={amount_paid}, total={total_paid}")
            
            display_amount = amount_due if amount_due > 0 else total_paid
            display_paid = amount_paid if amount_paid > 0 else total_paid
            
            logger.info(f"[SIM] 🖨️  Amount Due:   ₱{display_amount:.2f}")
            logger.info(f"[SIM] 🖨️  Amount Paid:  ₱{display_paid:.2f}")
            
            if change_amount > 0:
                logger.info(f"[SIM] 🖨️  Change:       ₱{change_amount:.2f}")
                if wallet_credit > 0:
                    logger.info(f"[SIM] 🖨️    -> Wallet:  ₱{wallet_credit:.2f}")
            elif wallet_credit > 0:
                logger.info(f"[SIM] 🖨️  Wallet Credit:₱{wallet_credit:.2f}")
            
            logger.info(f"[SIM] 🖨️  Total Paid:   ₱{display_paid:.2f}")
            logger.info(f"[SIM] 🖨️  Payment:      {str(data.get('payment_method', 'N/A')).title()}")
            
        elif data.get('type') == 'retrieval':
            logger.info(f"[SIM] 🖨️  RETRIEVAL RECEIPT")
            logger.info(f"[SIM] 🖨️  ================================")
            if data.get('module'):
                logger.info(f"[SIM] 🖨️  Module:       {data.get('module')}")
            logger.info(f"[SIM] 🖨️  Compartment:  {data.get('compartment_code', 'N/A')}")
            logger.info(f"[SIM] 🖨️  Rental Type:  {data.get('rental_type', 'N/A')}")
            logger.info(f"[SIM] 🖨️  --------------------------------")
            logger.info(f"[SIM] 🖨️  PAYMENT DETAILS")
            
            if float(data.get('refund_amount', 0)) > 0:
                logger.info(f"[SIM] 🖨️  ** EARLY RETRIEVAL REFUND **")
                logger.info(f"[SIM] 🖨️  Refunded:     ₱{float(data.get('refund_amount', 0)):.2f}")
                logger.info(f"[SIM] 🖨️    -> Wallet:  ₱{float(data.get('refund_amount', 0)):.2f}")
                logger.info(f"[SIM] 🖨️  --------------------------------")
            
            amount_due = float(data.get('amount_due', 0))
            if amount_due > 0:
                logger.info(f"[SIM] 🖨️  Amount Due:   ₱{amount_due:.2f}")
                logger.info(f"[SIM] 🖨️  Amount Paid:  ₱{float(data.get('amount_paid', 0)):.2f}")
                if float(data.get('change_amount', 0)) > 0:
                    logger.info(f"[SIM] 🖨️  Change:       ₱{float(data.get('change_amount', 0)):.2f}")
                if float(data.get('wallet_credit', 0)) > 0:
                    logger.info(f"[SIM] 🖨️    -> Wallet:  ₱{float(data.get('wallet_credit', 0)):.2f}")
                if data.get('payment_method'):
                    logger.info(f"[SIM] 🖨️  Payment:      {str(data.get('payment_method', 'N/A')).title()}")
            
            logger.info(f"[SIM] 🖨️  Total Charged:₱{float(data.get('amount', 0)):.2f}")

        logger.info(f"[SIM] 🖨️  Date: {time.strftime('%b %d, %Y %I:%M %p')}")
        logger.info("[SIM] 🖨️  ================================================")
