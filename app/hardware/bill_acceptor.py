"""
ALLAN TB74 Bill Selector/Acceptor driver.
Uses GPIO pulse mode for simple integration.

Wiring (12V external power required):
- Power wires  → +12V external power supply
- GND          → Common GND with Pi
- Yellow wire  → GPIO pin (pulse output, needs 10kΩ pull-up to 3.3V)
- Green wire   → GND (enable signal — pull LOW to enable)

DIP switch configuration determines pulse count per denomination.
Serial mode available at 9600 baud, 8N1 with Even Parity for advanced control.
"""
import logging

logger = logging.getLogger(__name__)

# Bill denomination to pulse count mapping
# Adjust based on TB74 DIP switch settings for Philippine Peso
BILL_PULSE_MAP = {
    1: 20,   # 1 pulse = ₱20 bill
    2: 50,   # 2 pulses = ₱50 bill
    3: 100,  # 3 pulses = ₱100 bill
}


class BillAcceptor:
    """ALLAN TB74 bill acceptor interface via GPIO pulse counting."""

    def __init__(self, gpio_pin, gpio_module):
        self.pin = gpio_pin
        self.GPIO = gpio_module
        self.pulse_count = 0
        self.enabled = False
        self._callback = None

    def enable(self):
        """Enable bill acceptance."""
        self.enabled = True
        self.pulse_count = 0
        logger.info(f"Bill acceptor enabled on GPIO {self.pin}")

    def disable(self):
        """Disable bill acceptance."""
        self.enabled = False
        logger.info("Bill acceptor disabled")

    def on_bill(self, callback):
        """Register callback for bill detection events."""
        self._callback = callback

    def handle_pulse(self, channel):
        """Called by GPIO interrupt on falling edge."""
        if not self.enabled:
            return
        self.pulse_count += 1
        if self._callback:
            self._callback(self.pulse_count)
