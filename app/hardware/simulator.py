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
        logger.info("[SIM] 🖨️  ==================== RECEIPT ====================")
        logger.info(f"[SIM] 🖨️  COIN CUBBY - Secure Storage Made Easy")
        logger.info(f"[SIM] 🖨️  ------------------------------------------------")

        if data.get('type') == 'rental':
            logger.info(f"[SIM] 🖨️  RENTAL CONFIRMATION")
            logger.info(f"[SIM] 🖨️  Compartment: {data.get('compartment_code', 'N/A')}")
            logger.info(f"[SIM] 🖨️  Rental Type: {data.get('rental_type', 'N/A')}")
            logger.info(f"[SIM] 🖨️  Duration: {data.get('duration', 'N/A')}")
            logger.info(f"[SIM] 🖨️  Total: ₱{data.get('total', 0):.2f}")
        elif data.get('type') == 'retrieval':
            logger.info(f"[SIM] 🖨️  RETRIEVAL RECEIPT")
            logger.info(f"[SIM] 🖨️  Compartment: {data.get('compartment_code', 'N/A')}")
            logger.info(f"[SIM] 🖨️  Amount Charged: ₱{data.get('amount', 0):.2f}")

        logger.info(f"[SIM] 🖨️  Date: {time.strftime('%b %d, %Y %I:%M %p')}")
        logger.info("[SIM] 🖨️  ================================================")
