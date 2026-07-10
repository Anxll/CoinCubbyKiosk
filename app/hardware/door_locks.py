"""
Solenoid door lock control via GPIO relay modules.
Each compartment has a dedicated relay pin.
HIGH = unlock (energize solenoid), LOW = locked (spring return).
"""
import logging
import threading
import time

logger = logging.getLogger(__name__)


class DoorLocks:
    """GPIO relay control for solenoid compartment locks."""

    def __init__(self, gpio_module, lock_pins: list):
        self.GPIO = gpio_module
        self.lock_pins = lock_pins

        # Initialize all locks as engaged (LOW)
        for pin in lock_pins:
            gpio_module.setup(pin, gpio_module.OUT)
            gpio_module.output(pin, gpio_module.LOW)

    def unlock(self, pin_index: int, duration: float = 10.0):
        """
        Unlock a compartment for a specified duration.
        Args:
            pin_index: Index into the lock_pins list
            duration: Seconds to keep unlocked (default 10s)
        """
        if pin_index >= len(self.lock_pins):
            raise ValueError(f"Invalid lock pin index: {pin_index}")

        pin = self.lock_pins[pin_index]
        self.GPIO.output(pin, self.GPIO.HIGH)
        logger.info(f"Lock unlocked: pin {pin} (index {pin_index})")

        def auto_relock():
            time.sleep(duration)
            self.GPIO.output(pin, self.GPIO.LOW)
            logger.info(f"Lock re-engaged: pin {pin} (index {pin_index})")

        threading.Thread(target=auto_relock, daemon=True).start()

    def lock(self, pin_index: int):
        """Immediately lock a compartment."""
        if pin_index < len(self.lock_pins):
            self.GPIO.output(self.lock_pins[pin_index], self.GPIO.LOW)

    def lock_all(self):
        """Lock all compartments."""
        for pin in self.lock_pins:
            self.GPIO.output(pin, self.GPIO.LOW)
