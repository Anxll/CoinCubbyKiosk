"""
DIY Change Dispenser driver.
Uses a servo motor on GPIO 23 via gpiozero to dispense ₱5 coins.

Mechanism:
  The servo is connected to a linear gear. Rotating from 0° → 180° pushes
  one coin out, then the servo returns to 0° (resting position).
  Each pulse cycle = 1 coin = ₱5.
  Pulse hold time = 1500ms before returning to rest.
"""
import logging
import time
import threading

logger = logging.getLogger(__name__)

# GPIO pin for the servo control signal (BCM numbering)
CHANGE_DISPENSER_PIN = 23

# ₱ value of each dispensed coin
COIN_VALUE = 5

# How long (seconds) to hold the servo at 180° before returning to 0°
PULSE_DURATION = 1.5

# Delay between consecutive coin pulses (allows mechanism to reset)
INTER_COIN_DELAY = 0.5


class ChangeDispenser:
    """
    DIY change dispenser using a servo on GPIO 23.

    The servo output is controlled via gpiozero's Servo class.
    value = -1  →  0°   (rest/default position)
    value =  1  → 180°  (dispense position — pushes coin out)
    """

    def __init__(self, simulation_mode: bool):
        self.simulation_mode = simulation_mode
        self._servo = None
        self._lock = threading.Lock()

        if not self.simulation_mode:
            try:
                from gpiozero import Servo
                # min_pulse_width / max_pulse_width tuned for SG90-type servos
                self._servo = Servo(
                    CHANGE_DISPENSER_PIN,
                    min_pulse_width=0.5 / 1000,
                    max_pulse_width=2.5 / 1000
                )
                # Make sure it starts at rest (0°)
                self._servo.min()
                logger.info(
                    f"Change dispenser initialised on GPIO {CHANGE_DISPENSER_PIN} — servo at rest (0°)"
                )
            except Exception as e:
                logger.error(
                    f"Change dispenser: failed to initialise servo on GPIO {CHANGE_DISPENSER_PIN}: {e}"
                )
                self.simulation_mode = True

    def dispense(self, amount: float) -> int:
        """
        Dispense the given amount in ₱5 coins.

        Each coin = one servo pulse: rotate to 180°, hold 1500ms, return to 0°.

        Args:
            amount: Total change amount in pesos (e.g. 15.0 → 3 coins).

        Returns:
            Number of coins actually dispensed.
        """
        coins = int(amount // COIN_VALUE)
        if coins <= 0:
            logger.info(f"Change dispenser: amount ₱{amount:.2f} — no coins to dispense.")
            return 0

        logger.info(f"Change dispenser: dispensing {coins} × ₱{COIN_VALUE} = ₱{coins * COIN_VALUE}")

        if self.simulation_mode:
            for i in range(coins):
                logger.info(f"  [SIM] Coin {i + 1}/{coins} dispensed (₱{COIN_VALUE})")
                time.sleep(PULSE_DURATION + INTER_COIN_DELAY)
            return coins

        with self._lock:
            for i in range(coins):
                try:
                    logger.info(f"  Coin {i + 1}/{coins}: servo → 180°")
                    self._servo.max()          # Rotate to 180° — pushes coin
                    time.sleep(PULSE_DURATION) # Hold for 1500ms
                    self._servo.min()          # Return to 0° — reset
                    logger.info(f"  Coin {i + 1}/{coins}: servo → 0° (rest)")
                    if i < coins - 1:
                        time.sleep(INTER_COIN_DELAY)
                except Exception as e:
                    logger.error(f"Change dispenser error on coin {i + 1}: {e}")
                    break

        return coins

    def dispense_async(self, amount: float, on_complete=None):
        """
        Dispense change in a background thread so the HTTP request can return immediately.

        Args:
            amount: Total change in pesos.
            on_complete: Optional callback(coins_dispensed) called when done.
        """
        def _run():
            coins = self.dispense(amount)
            if on_complete:
                on_complete(coins)

        t = threading.Thread(target=_run, daemon=True)
        t.start()

    def close(self):
        """Release the servo pin cleanly on shutdown."""
        if self._servo:
            try:
                self._servo.min()
                self._servo.close()
                logger.info("Change dispenser servo closed.")
            except Exception:
                pass
