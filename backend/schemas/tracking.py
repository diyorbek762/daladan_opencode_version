"""
Daladan Platform — Live Tracking Pydantic Schemas
Models for WebSocket GPS messages and nearest-order responses.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════
#  Incoming GPS Message
# ═══════════════════════════════════════════════════════


class GPSUpdate(BaseModel):
    """A single GPS coordinate sent by the driver's device."""

    lat: float = Field(
        ..., ge=-90, le=90,
        description="Latitude (WGS-84)",
        examples=[41.3111],
    )
    lng: float = Field(
        ..., ge=-180, le=180,
        description="Longitude (WGS-84)",
        examples=[69.2797],
    )
    timestamp: Optional[datetime] = Field(
        default=None,
        description="Client-side UTC timestamp of the GPS fix (optional)",
    )


# ═══════════════════════════════════════════════════════
#  Nearest-Order Result
# ═══════════════════════════════════════════════════════


class NearestOrderResult(BaseModel):
    """One unassigned order returned by the nearest-neighbour query."""

    deal_id: str = Field(..., description="UUID of the deal_group")
    deal_number: int = Field(..., description="Human-readable deal number")
    title: str = Field(..., description="Deal title (e.g. 'Golden Apples')")
    distance_km: float = Field(..., description="Distance from driver in km")
    pickup_lat: float
    pickup_lng: float


# ═══════════════════════════════════════════════════════
#  WebSocket Response Envelope
# ═══════════════════════════════════════════════════════


class TrackingResponse(BaseModel):
    """JSON envelope sent back to the driver over the WebSocket."""

    status: str = Field(
        "ok",
        description="'ok' or 'error'",
    )
    message: Optional[str] = Field(
        default=None,
        description="Human-readable status message",
    )
    nearest_orders: list[NearestOrderResult] = Field(
        default_factory=list,
        description="Closest unassigned orders (greedy nearest-neighbour)",
    )
