"""
Door sensor monitoring via GPIO input pins.
Magnetic reed switches or micro switches detect door open/close state.
Using internal pull-up resistors — switch connects pin to GND when door is closed.
HIGH = door open, LOW = door closed.
"""
import logging

logger = logging.getLogger(__name__)


class DoorSensors:
    """GPIO input monitoring for compartment door sensors."""

    def __init__(self, gpio_module, sensor_pins: list):
        self.GPIO = gpio_module
        self.sensor_pins = sensor_pins

        # Initialize sensor pins with internal pull-up
        for pin in sensor_pins:
            gpio_module.setup(pin, gpio_module.IN, pull_up_down=gpio_module.PUD_UP)

    def is_open(self, pin_index: int) -> bool:
        """Check if a door is open."""
        if pin_index >= len(self.sensor_pins):
            raise ValueError(f"Invalid sensor pin index: {pin_index}")

        return self.GPIO.input(self.sensor_pins[pin_index]) == self.GPIO.HIGH

    def is_closed(self, pin_index: int) -> bool:
        """Check if a door is closed."""
        return not self.is_open(pin_index)

    def on_state_change(self, pin_index: int, callback):
        """Register callback for door state changes."""
        if pin_index >= len(self.sensor_pins):
            return

        pin = self.sensor_pins[pin_index]
        self.GPIO.add_event_detect(pin, self.GPIO.BOTH,
                                    callback=lambda ch: callback(pin_index, self.is_open(pin_index)),
                                    bouncetime=200)
