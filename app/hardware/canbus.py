"""
CAN Bus controller for communicating with physical compartment hardware.
Uses the python-can library via the Linux SocketCAN interface (can0).

Protocol — 3 Standard CAN frames to unlock a compartment:
  Packet 1: Arbitration ID 0x100, 8 bytes — Locker ID MSB (first 8 chars of module device_code)
  Packet 2: Arbitration ID 0x101, 8 bytes — Locker ID LSB (last  8 chars of module device_code)
  Packet 3: Arbitration ID 0x102, 2 bytes — Compartment ID      (e.g. S1, M1, L1)

All frames are Standard (non-extended) CAN frames.
The CAN controller is strictly a sender — no interrupt pin is used.
The device_code comes from the Supabase 'modules' table per compartment — NOT from .env.
"""
import logging
import time

logger = logging.getLogger(__name__)

# Arbitration IDs for the 3-packet unlock sequence
_CAN_ID_MSB  = 0x100   # Locker ID MSB
_CAN_ID_LSB  = 0x101   # Locker ID LSB
_CAN_ID_COMP = 0x102   # Compartment ID

# Virtual SocketCAN interface name
_CAN_CHANNEL = 'can0'


class CanBusController:
    """Manages CAN bus communication for compartment locks via SocketCAN (can0)."""

    def __init__(self, simulation_mode: bool):
        self.simulation_mode = simulation_mode
        self.bus = None

        if not self.simulation_mode:
            try:
                import can
                self.can = can
                self.bus = can.interface.Bus(channel=_CAN_CHANNEL, bustype='socketcan')
                logger.info(f"CAN bus initialised on {_CAN_CHANNEL}")
            except ImportError:
                logger.warning("python-can not installed — falling back to simulation.")
                self.simulation_mode = True
            except Exception as e:
                logger.error(f"Failed to initialise CAN bus on {_CAN_CHANNEL}: {e} — falling back to simulation.")
                self.simulation_mode = True

    def unlock_compartment(self, compartment_code: str, device_code: str):
        """
        Send the 3-packet CAN sequence to unlock a compartment.

        Args:
            compartment_code: The compartment ID (e.g. 'S1', 'M1', 'L1').
            device_code: The 16-char module device code from the Supabase modules table
                         (e.g. 'AMSJFIWESLFIENSA'). This identifies which physical module to target.

        Example for device_code='AMSJFIWESLFIENSA', compartment_code='S1':
          TX  0x100  [8]  41 4D 53 4A 46 49 57 45   (AMSJFIWE)
          TX  0x101  [8]  53 4C 46 49 45 4E 53 41   (SLFIENSA)
          TX  0x102  [2]  53 31                      (S1)
        """
        # Pad / truncate device code to exactly 16 ASCII characters
        dev = str(device_code).ljust(16)[:16]

        if self.simulation_mode:
            logger.info(
                f"[SIM CAN] Unlock sequence for compartment '{compartment_code}' "
                f"on module '{dev}':\n"
                f"  TX 0x100 [8] {dev[:8]!r}\n"
                f"  TX 0x101 [8] {dev[8:16]!r}\n"
                f"  TX 0x102 [2] {compartment_code!r}"
            )
            return

        if not self.bus:
            logger.error("CAN bus is not connected. Cannot unlock compartment.")
            return

        try:
            # Prepare byte payloads
            msb_bytes  = dev[:8].encode('ascii')                            # 8 bytes
            lsb_bytes  = dev[8:16].encode('ascii')                         # 8 bytes
            comp_bytes = str(compartment_code).ljust(2)[:2].encode('ascii') # 2 bytes

            # Packet 1 — Locker ID MSB  (Arbitration ID 0x100)
            self.bus.send(self.can.Message(
                arbitration_id=_CAN_ID_MSB,
                data=msb_bytes,
                is_extended_id=False
            ))
            time.sleep(0.01)

            # Packet 2 — Locker ID LSB  (Arbitration ID 0x101)
            self.bus.send(self.can.Message(
                arbitration_id=_CAN_ID_LSB,
                data=lsb_bytes,
                is_extended_id=False
            ))
            time.sleep(0.01)

            # Packet 3 — Compartment ID  (Arbitration ID 0x102)
            self.bus.send(self.can.Message(
                arbitration_id=_CAN_ID_COMP,
                data=comp_bytes,
                is_extended_id=False
            ))

            logger.info(
                f"CAN unlock sent — module='{dev}' compartment='{compartment_code}'"
            )

        except Exception as e:
            logger.error(f"CAN bus error during unlock of '{compartment_code}' on module '{dev}': {e}")
