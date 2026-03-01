"""
Daladan Platform — In-Memory Driver State
Zero-database-bloat GPS storage for active drivers.

All live GPS positions are stored in a thread-safe Python dictionary.
Only the latest position per driver is kept — no history, no DB writes.

Usage:
    from backend.services.driver_state import active_drivers, update_driver, get_driver

    update_driver("uuid", 41.00, 71.67)
    pos = get_driver("uuid")  # {"lat": 41.00, "lng": 71.67, "updated_at": ...}
"""
import time
import logging
from typing import Optional, TypedDict

logger = logging.getLogger("daladan.driver_state")


class DriverPosition(TypedDict):
    lat: float
    lng: float
    updated_at: float  # Unix timestamp


# ═══════════════════════════════════════════════════════
#  Global in-memory store
# ═══════════════════════════════════════════════════════

active_drivers: dict[str, DriverPosition] = {}


def update_driver(driver_id: str, lat: float, lng: float) -> DriverPosition:
    """Store or update a driver's GPS position in memory."""
    pos: DriverPosition = {
        "lat": lat,
        "lng": lng,
        "updated_at": time.time(),
    }
    active_drivers[driver_id] = pos
    return pos


def get_driver(driver_id: str) -> Optional[DriverPosition]:
    """Get a driver's latest position, or None if not tracked."""
    return active_drivers.get(driver_id)


def remove_driver(driver_id: str) -> None:
    """Remove a driver from the active tracking store."""
    active_drivers.pop(driver_id, None)


def get_all_drivers() -> dict[str, DriverPosition]:
    """Get a snapshot of all active driver positions."""
    return dict(active_drivers)
