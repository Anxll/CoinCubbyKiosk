"""
Central hardware manager — coordinates all peripheral devices.
Auto-detects Raspberry Pi and falls back to simulation mode.
"""
import logging
import platform

logger = logging.getLogger(__name__)


class HardwareManager:
    """Unified interface for all kiosk hardware peripherals."""

    def __init__(self, config):
        self.config = config
        self.simulation_mode = config.get('SIMULATION_MODE', True)
        self.cash_target = 0
        self._inserted_amount = 0
        self._cash_accepting = False
        self.coin_acceptor_pin = None
        self.coin_enable_pin = None
        self.coin_pulse_value = float(config.get('COIN_ACCEPTOR_PULSE_VALUE', 5.0))
        self.coin_bouncetime_ms = int(config.get('COIN_ACCEPTOR_BOUNCETIME_MS', 30))
        self.bill_acceptor_pin = None
        self.bill_enable_pin = None
        self.bill_pulse_value = float(config.get('BILL_ACCEPTOR_PULSE_VALUE', 10.0))
        self.bill_bouncetime_ms = int(config.get('BILL_ACCEPTOR_BOUNCETIME_MS', 20))

        # Detect if running on Raspberry Pi
        if not self.simulation_mode:
            try:
                import RPi.GPIO as GPIO
                self.GPIO = GPIO
                GPIO.setmode(GPIO.BCM)
                GPIO.setwarnings(False)
                logger.info("Hardware Manager: Running on Raspberry Pi (LIVE mode)")
                self._init_gpio(config)
            except (ImportError, RuntimeError):
                logger.warning("Hardware Manager: RPi.GPIO not available, switching to SIMULATION mode")
                self.simulation_mode = True

        if self.simulation_mode:
            logger.info("Hardware Manager: Running in SIMULATION mode")
            from .simulator import HardwareSimulator
            self.simulator = HardwareSimulator(self)

        # Initialize CAN Bus for doors
        from .canbus import CanBusController
        self.can_bus = CanBusController(
            simulation_mode=self.simulation_mode, 
            device_code=config.get('DEVICE_CODE', 'DEVICE001')
        )

    def _init_gpio(self, config):
        """Initialize GPIO pins for locks and sensors."""
        # TODO

    def _coin_pulse_callback(self, channel):
        """Handle coin acceptor pulse (JY-100F)."""
        if self._cash_accepting:
            self._inserted_amount += self.coin_pulse_value
            logger.info(f"Coin pulse detected (+₱{self.coin_pulse_value}). Total inserted: ₱{self._inserted_amount}")

    def _bill_pulse_callback(self, channel):
        """Handle bill acceptor pulse (TB74)."""
        if self._cash_accepting:
            self._inserted_amount += self.bill_pulse_value
            logger.info(f"Bill pulse detected (+₱{self.bill_pulse_value}). Total inserted: ₱{self._inserted_amount}")

    # === Compartment mapping ===
    # Maps compartment codes to their GPIO pin indices
    COMPARTMENT_PIN_MAP = {
        'A01': 0, 'A02': 1, 'A03': 2, 'A04': 3,
        'B01': 4, 'B02': 5, 'B03': 6, 'B04': 7,
        # Alternative naming scheme (Small, Medium, Large)
        'S1': 0, 'S2': 1, 'S3': 2, 'S4': 3,
        'M1': 4, 'M2': 5,
        'L1': 6, 'L2': 7,
    }

    def unlock_door(self, compartment_code: str):
        """Unlock a compartment door via CAN bus."""
        # The can_bus controller handles simulation mode internally
        self.can_bus.unlock_compartment(compartment_code)

    def get_door_status(self, compartment_code: str) -> bool:
        """Check if a compartment door is open. Returns True if open."""
        if self.simulation_mode:
            return self.simulator.get_door_status(compartment_code)

        idx = self.COMPARTMENT_PIN_MAP.get(compartment_code)
        if idx is None or idx >= len(self.sensor_pins):
            raise ValueError(f"Unknown compartment: {compartment_code}")

        return self.GPIO.input(self.sensor_pins[idx]) == self.GPIO.HIGH

    def start_cash_acceptance(self, target_amount: float):
        """Enable coin and bill acceptors."""
        self.cash_target = target_amount
        self._inserted_amount = 0
        self._cash_accepting = True

        if not self.simulation_mode:
            if self.coin_enable_pin is not None:
                self.GPIO.output(self.coin_enable_pin, self.GPIO.LOW)
            if self.bill_enable_pin is not None:
                self.GPIO.output(self.bill_enable_pin, self.GPIO.LOW)

        if self.simulation_mode:
            self.simulator.start_cash_simulation(target_amount)

        logger.info(f"Cash acceptance started. Target: ₱{target_amount}")

    def stop_cash_acceptance(self):
        """Disable coin and bill acceptors."""
        self._cash_accepting = False

        if not self.simulation_mode:
            if self.coin_enable_pin is not None:
                self.GPIO.output(self.coin_enable_pin, self.GPIO.HIGH)
            if self.bill_enable_pin is not None:
                self.GPIO.output(self.bill_enable_pin, self.GPIO.HIGH)

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
            'coin_acceptor_pin': self.coin_acceptor_pin,
            'coin_enable_pin': self.coin_enable_pin,
            'coin_pulse_value': self.coin_pulse_value,
            'coin_bouncetime_ms': self.coin_bouncetime_ms,
            'bill_acceptor_pin': self.bill_acceptor_pin,
            'bill_enable_pin': self.bill_enable_pin,
            'bill_pulse_value': self.bill_pulse_value,
            'bill_bouncetime_ms': self.bill_bouncetime_ms
        }

    def insert_cash(self, amount: float):
        """Manually register a cash insertion (triggered by F13/F14 keypress via API).
        In live mode, this is handled by GPIO callbacks — this method is for simulation only.
        """
        if self.simulation_mode:
            self.simulator.insert_cash(amount)
        else:
            # On real hardware, GPIO handles this — but allow manual override if needed
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
