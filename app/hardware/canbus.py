"""
CAN Bus controller for communicating with physical compartment hardware.
Uses the python-can library via the Linux socketcan interface (can0).
"""
import logging
import time

logger = logging.getLogger(__name__)

class CanBusController:
    """Manages CAN bus communication for compartment locks."""

    def __init__(self, simulation_mode: bool, device_code: str):
        self.simulation_mode = simulation_mode
        # Ensure exactly 16 characters for the protocol (pad with spaces if needed)
        self.device_code = str(device_code).ljust(16, ' ')[:16]
        self.bus = None

        if not self.simulation_mode:
            try:
                import can
                self.can = can
                # Connect to the SPI CAN module configured in Linux as 'can0'
                self.bus = can.interface.Bus(channel='can0', bustype='socketcan')
                logger.info("CAN bus initialized successfully on can0")
            except ImportError:
                logger.warning("CAN bus disabled: python-can library not installed. Falling back to simulation.")
                self.simulation_mode = True
            except Exception as e:
                logger.error(f"Failed to initialize CAN bus on can0: {e}")
                self.simulation_mode = True

    def unlock_compartment(self, compartment_code: str):
        """
        Send a sequence of 3 CAN packets to unlock a compartment.
        Protocol:
          Sender ID: 0x100 (Standard Frame)
          Packet 1: First 8 chars of Device ID
          Packet 2: Last 8 chars of Device ID
          Packet 3: Compartment ID (padded to 2 chars)
        """
        if self.simulation_mode:
            logger.info(f"[SIM CAN] 🔓 Sending CAN unlock sequence for compartment: {compartment_code}")
            return

        if not self.bus:
            logger.error("CAN bus is not connected. Cannot unlock compartment.")
            return

        try:
            # Prepare payloads as byte arrays (ASCII)
            msb = self.device_code[:8].encode('ascii')
            lsb = self.device_code[8:16].encode('ascii')
            # Ensure compartment code is exactly 2 characters (pad if needed, though usually S1, M1, etc.)
            comp_code = str(compartment_code).ljust(2, ' ')[:2].encode('ascii')

            # Packet 1: Locker ID MSB
            msg1 = self.can.Message(arbitration_id=0x100, data=msb, is_extended_id=False)
            self.bus.send(msg1)
            time.sleep(0.01) # Small delay to prevent buffer overrun on the receiver

            # Packet 2: Locker ID LSB
            msg2 = self.can.Message(arbitration_id=0x100, data=lsb, is_extended_id=False)
            self.bus.send(msg2)
            time.sleep(0.01)

            # Packet 3: Compartment ID
            msg3 = self.can.Message(arbitration_id=0x100, data=comp_code, is_extended_id=False)
            self.bus.send(msg3)

            logger.info(f"CAN unlock sequence successfully sent for compartment {compartment_code}")

        except Exception as e:
            logger.error(f"CAN bus error during unlock sequence for {compartment_code}: {e}")
