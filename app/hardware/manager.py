"""
Central hardware manager — coordinates all peripheral devices.
Auto-detects Raspberry Pi and falls back to simulation mode.
Uses gpiozero for GPIO interactions.
"""
import logging
import os

logger = logging.getLogger(__name__)

# GPIO pin for the bill acceptor inhibit line.
# HIGH = inhibited (bills rejected) — default state on all screens.
# LOW  = enabled (bills accepted)  — only during cash payment screen.
BILL_INHIBIT_PIN = 22

class HardwareManager:
    """Unified interface for all kiosk hardware peripherals using gpiozero."""

    def __init__(self, config):
        self.config = config
        self.simulation_mode = config.get('SIMULATION_MODE', True)
        self.cash_target = 0
        self._inserted_amount = 0
        self._cash_accepting = False
        self.bill_inhibit = None

        # Detect if running on Raspberry Pi and initialize gpiozero
        if not self.simulation_mode:
            try:
                from gpiozero import DigitalOutputDevice
                # Initialize pin 22, active_high=True (HIGH = 3.3V, LOW = 0V), initial_value=True (HIGH on startup)
                self.bill_inhibit = DigitalOutputDevice(BILL_INHIBIT_PIN, active_high=True, initial_value=True)
                logger.info(f"Hardware Manager: gpiozero initialized pin {BILL_INHIBIT_PIN} HIGH (inhibited)")
            except Exception as e:
                logger.warning(f"Hardware Manager: gpiozero not available or failed: {e}. Switching to SIMULATION mode.")
                self.simulation_mode = True

        if self.simulation_mode:
            logger.info("Hardware Manager: Running in SIMULATION mode")
            from .simulator import HardwareSimulator
            self.simulator = HardwareSimulator(self)

        # Initialize CAN Bus for doors
        from .canbus import CanBusController
        self.can_bus = CanBusController(simulation_mode=self.simulation_mode)

    # === Compartment mapping ===
    # Maps compartment codes to their CAN bus index/identifier
    COMPARTMENT_PIN_MAP = {
        'A01': 0, 'A02': 1, 'A03': 2, 'A04': 3,
        'B01': 4, 'B02': 5, 'B03': 6, 'B04': 7,
        # Alternative naming scheme (Small, Medium, Large)
        'S1': 0, 'S2': 1, 'S3': 2, 'S4': 3,
        'M1': 4, 'M2': 5,
        'L1': 6, 'L2': 7,
    }

    def unlock_door(self, compartment_code: str, device_code: str):
        """Unlock a compartment door via CAN bus.
        
        Args:
            compartment_code: e.g. 'S1', 'M1', 'L1'
            device_code: 16-char module ID from the Supabase modules table.
        """
        self.can_bus.unlock_compartment(compartment_code, device_code)

    def get_door_status(self, compartment_code: str) -> bool:
        """Check if a compartment door is open. Returns True if open."""
        if self.simulation_mode:
            return self.simulator.get_door_status(compartment_code)
        
        # Physical door sensors are disabled; assume closed
        return False

    def start_cash_acceptance(self, target_amount: float):
        """Enable bill acceptor (set inhibit pin LOW)."""
        self.cash_target = target_amount
        self._inserted_amount = 0
        self._cash_accepting = True

        if not self.simulation_mode and self.bill_inhibit:
            try:
                self.bill_inhibit.off() # Sets the pin to LOW (0V) -> Enables acceptor
                logger.info(f"HARDWARE: Bill acceptor ENABLED (pin {BILL_INHIBIT_PIN} = LOW)")
            except Exception as e:
                logger.error(f"Failed to enable bill acceptor pin: {e}")
        elif not self.simulation_mode:
            logger.warning("Bill acceptor control is active but no physical pin is configured.")

        if self.simulation_mode:
            self.simulator.start_cash_simulation(target_amount)

        logger.info(f"Cash acceptance started. Target: ₱{target_amount}")

    def stop_cash_acceptance(self):
        """Disable bill acceptor (set inhibit pin HIGH)."""
        self._cash_accepting = False

        if not self.simulation_mode and self.bill_inhibit:
            try:
                self.bill_inhibit.on() # Sets the pin to HIGH (3.3V) -> Inhibits acceptor
                logger.info(f"HARDWARE: Bill acceptor INHIBITED (pin {BILL_INHIBIT_PIN} = HIGH)")
            except Exception as e:
                logger.error(f"Failed to inhibit bill acceptor pin: {e}")

        if self.simulation_mode:
            self.simulator.stop_cash_simulation()

        logger.info("Cash acceptance stopped")

    def get_inserted_amount(self) -> float:
        """Get the current total inserted amount."""
        if self.simulation_mode:
            return self.simulator.get_inserted_amount()
        return self._inserted_amount

    def get_cash_status(self) -> dict:
        """Return cash acceptor state for kiosk diagnostics."""
        current_amount = self.get_inserted_amount()
        overpayment = max(0, current_amount - self.cash_target)
        return {
            'simulation_mode': self.simulation_mode,
            'cash_accepting': self._cash_accepting,
            'inserted': current_amount,
            'target': self.cash_target,
            'remaining': max(0, self.cash_target - current_amount),
            'overpayment': overpayment,
            'complete': self.cash_target > 0 and current_amount >= self.cash_target,
        }

    def insert_cash(self, amount: float):
        """Manually register a cash insertion (triggered by F13/F14 keypress via API)."""
        if self.simulation_mode:
            self.simulator.insert_cash(amount)
        else:
            if self._cash_accepting:
                self._inserted_amount += amount
                logger.info(f"Manual cash insert: +₱{amount} (Total: ₱{self._inserted_amount})")

    def print_receipt(self, data: dict):
        """Print a receipt via thermal printer."""
        if self.simulation_mode:
            self.simulator.print_receipt(data)
            return

        from .thermal_printer import print_receipt
        print_receipt(data)
