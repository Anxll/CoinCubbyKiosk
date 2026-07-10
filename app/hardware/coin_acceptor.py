"""
JY-100F Universal Multi Coin Acceptor driver.
Uses GPIO pulse counting — each pulse represents a coin insertion.

Wiring (12V external power required):
- Red wire    → +12V external power supply
- Black wire  → GND (common with Pi GND)
- White wire  → GPIO pin via voltage divider (56kΩ + 22kΩ) or opto-isolator
- Grey wire   → Not used (counter output)

Pulse configuration is set via DIP switches on the JY-100F unit.
Default: 1 pulse = ₱1, configure for your specific coin set.
"""
import logging

logger = logging.getLogger(__name__)

# Coin denomination to pulse count mapping
# Adjust these based on your JY-100F DIP switch configuration
COIN_PULSE_MAP = {
    1: 1,   # ₱1 coin = 1 pulse
    5: 5,   # ₱5 coin = 5 pulses
    10: 10, # ₱10 coin = 10 pulses
}


class CoinAcceptor:
    """JY-100F coin acceptor interface via GPIO pulse counting."""

    def __init__(self, gpio_pin, gpio_module):
        self.pin = gpio_pin
        self.GPIO = gpio_module
        self.pulse_count = 0
        self.enabled = False
        self._callback = None

    def enable(self):
        """Enable coin acceptance."""
        self.enabled = True
        self.pulse_count = 0
        logger.info(f"Coin acceptor enabled on GPIO {self.pin}")

    def disable(self):
        """Disable coin acceptance."""
        self.enabled = False
        logger.info("Coin acceptor disabled")

    def on_pulse(self, callback):
        """Register callback for coin detection events."""
        self._callback = callback

    def handle_pulse(self, channel):
        """Called by GPIO interrupt on falling edge."""
        if not self.enabled:
            return
        self.pulse_count += 1
        if self._callback:
            self._callback(self.pulse_count)
