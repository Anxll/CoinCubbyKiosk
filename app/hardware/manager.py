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

    def _init_gpio(self, config):
        """Initialize GPIO pins for locks and sensors."""
        # Door lock pins (output)
        self.lock_pins = config.get('DOOR_LOCK_PINS', [])
        for pin in self.lock_pins:
            self.GPIO.setup(pin, self.GPIO.OUT)
            self.GPIO.output(pin, self.GPIO.LOW)  # Locks engaged

        # Door sensor pins (input with pull-up)
        self.sensor_pins = config.get('DOOR_SENSOR_PINS', [])
        for pin in self.sensor_pins:
            self.GPIO.setup(pin, self.GPIO.IN, pull_up_down=self.GPIO.PUD_UP)

        # Coin acceptor (input with pull-up)
        coin_pin = config.get('COIN_ACCEPTOR_PIN', 17)
        self.GPIO.setup(coin_pin, self.GPIO.IN, pull_up_down=self.GPIO.PUD_UP)
        self.GPIO.add_event_detect(coin_pin, self.GPIO.FALLING,
                                    callback=self._coin_pulse_callback, bouncetime=50)

        # Bill acceptor (input with pull-up)
        bill_pin = config.get('BILL_ACCEPTOR_PIN', 27)
        self.GPIO.setup(bill_pin, self.GPIO.IN, pull_up_down=self.GPIO.PUD_UP)
        self.GPIO.add_event_detect(bill_pin, self.GPIO.FALLING,
                                    callback=self._bill_pulse_callback, bouncetime=100)

    def _coin_pulse_callback(self, channel):
        """Handle coin acceptor pulse (JY-100F)."""
        if self._cash_accepting:
            # JY-100F sends different pulse counts for different denominations
            # This needs calibration based on your coin acceptor settings
            self._inserted_amount += 1  # Default: 1 peso per pulse
            logger.info(f"Coin detected. Total inserted: ₱{self._inserted_amount}")

    def _bill_pulse_callback(self, channel):
        """Handle bill acceptor pulse (TB74)."""
        if self._cash_accepting:
            # TB74 sends pulses based on bill denomination
            # This needs calibration based on DIP switch settings
            self._inserted_amount += 20  # Default: 20 peso per pulse
            logger.info(f"Bill detected. Total inserted: ₱{self._inserted_amount}")

    # === Compartment mapping ===
    # Maps compartment codes to their GPIO pin indices
    COMPARTMENT_PIN_MAP = {
        'A01': 0, 'A02': 1, 'A03': 2, 'A04': 3,
        'B01': 4, 'B02': 5, 'B03': 6, 'B04': 7,
    }

    def unlock_door(self, compartment_code: str):
        """Unlock a compartment door for a brief period."""
        if self.simulation_mode:
            self.simulator.unlock_door(compartment_code)
            return

        idx = self.COMPARTMENT_PIN_MAP.get(compartment_code)
        if idx is None or idx >= len(self.lock_pins):
            raise ValueError(f"Unknown compartment: {compartment_code}")

        pin = self.lock_pins[idx]
        self.GPIO.output(pin, self.GPIO.HIGH)  # Unlock (energize solenoid)

        import threading
        def relock():
            import time
            time.sleep(10)  # Keep unlocked for 10 seconds
            self.GPIO.output(pin, self.GPIO.LOW)

        threading.Thread(target=relock, daemon=True).start()
        logger.info(f"Door unlocked: {compartment_code} (pin {pin})")

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

        if self.simulation_mode:
            self.simulator.start_cash_simulation(target_amount)

        logger.info(f"Cash acceptance started. Target: ₱{target_amount}")

    def stop_cash_acceptance(self):
        """Disable coin and bill acceptors."""
        self._cash_accepting = False

        if self.simulation_mode:
            self.simulator.stop_cash_simulation()

        logger.info("Cash acceptance stopped")

    def get_inserted_amount(self) -> float:
        """Get the current total inserted amount."""
        if self.simulation_mode:
            return self.simulator.get_inserted_amount()
        return self._inserted_amount

    def print_receipt(self, data: dict):
        """Print a receipt via thermal printer."""
        if self.simulation_mode:
            self.simulator.print_receipt(data)
            return

        from .thermal_printer import print_receipt
        print_receipt(data)
