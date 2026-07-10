"""
Hardware simulator for development on non-Pi systems.
Simulates coin/bill insertion, door locks, and thermal printing.
"""
import logging
import threading
import time
import random

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
        """Start simulating coin/bill insertions."""
        self._inserted_amount = 0
        self._simulating = True

        def simulate():
            denominations = [1, 5, 10, 20, 50, 100]
            while self._simulating and self._inserted_amount < target_amount:
                time.sleep(random.uniform(1.0, 3.0))
                if not self._simulating:
                    break
                # Randomly pick a denomination
                remaining = target_amount - self._inserted_amount
                valid_denoms = [d for d in denominations if d <= remaining]
                if not valid_denoms:
                    break
                coin = random.choice(valid_denoms)
                self._inserted_amount += coin
                label = "🪙 Coin" if coin <= 10 else "💵 Bill"
                logger.info(f"[SIM] {label} inserted: ₱{coin} (Total: ₱{self._inserted_amount})")

        self._simulation_thread = threading.Thread(target=simulate, daemon=True)
        self._simulation_thread.start()

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
