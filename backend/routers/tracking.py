"""
Daladan Platform — Real-Time Driver Tracking & Predictive Routing

Endpoints:
    WebSocket  ws://<host>/api/tracking/ws/{driver_id}
        → Receives GPS, stores IN-MEMORY (zero DB bloat), returns nearest orders

    GET  /api/tracking/predict-route/{driver_id}
        → Greedy nearest-neighbour chains up to 3 orders + ORS driving route

Message protocol (WebSocket, JSON):
    → Client sends:   {"lat": 41.31, "lng": 69.28}
    ← Server replies: {"status": "ok", "nearest_orders": [...]}
"""
import json
import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import ValidationError

from backend.database import async_session
from backend.schemas.tracking import GPSUpdate, TrackingResponse
from backend.services.driver_state import (
    active_drivers,
    update_driver,
    get_driver,
    remove_driver,
)
from backend.services.nearest_order import find_nearest_unassigned_order
from backend.services.predictive_router import predict_route

logger = logging.getLogger("daladan.tracking")

router = APIRouter(prefix="/api/tracking", tags=["Tracking"])


# ── Active WebSocket connections (for future fleet broadcast) ──
active_connections: dict[str, WebSocket] = {}


# ═══════════════════════════════════════════════════════
#  WebSocket — Live GPS (in-memory, zero DB writes)
# ═══════════════════════════════════════════════════════


@router.websocket("/ws/{driver_id}")
async def driver_tracking_ws(websocket: WebSocket, driver_id: str):
    """
    WebSocket endpoint for live driver GPS tracking.

    Flow per message:
      1. Parse & validate the GPS payload
      2. Store in active_drivers dict (IN-MEMORY — no DB write)
      3. Query PostGIS for nearest unassigned orders
      4. Send back the result as JSON
    """
    await websocket.accept()
    active_connections[driver_id] = websocket
    logger.info("Driver %s connected to tracking WebSocket", driver_id)

    # Validate UUID once
    try:
        UUID(driver_id)
    except ValueError:
        await websocket.send_json(
            TrackingResponse(
                status="error",
                message=f"Invalid driver_id: {driver_id}",
            ).model_dump()
        )
        await websocket.close(code=1008)
        return

    try:
        while True:
            raw = await websocket.receive_text()

            # ── 1. Parse GPS ──
            try:
                data = json.loads(raw)
                gps = GPSUpdate(**data)
            except (json.JSONDecodeError, ValidationError) as exc:
                await websocket.send_json(
                    TrackingResponse(
                        status="error",
                        message=f"Invalid GPS payload: {exc}",
                    ).model_dump()
                )
                continue

            # ── 2. Store in-memory (NO database write) ──
            update_driver(driver_id, gps.lat, gps.lng)

            # ── 3. Query nearest unassigned orders from PostGIS ──
            try:
                async with async_session() as session:
                    nearest = await find_nearest_unassigned_order(
                        session, lat=gps.lat, lng=gps.lng,
                    )
            except Exception as exc:
                logger.error("DB query failed for driver %s: %s", driver_id, exc)
                nearest = []

            # ── 4. Send response ──
            response = TrackingResponse(
                status="ok",
                message=f"Position stored. {len(nearest)} nearby order(s).",
                nearest_orders=nearest,
            )
            await websocket.send_json(response.model_dump())

    except WebSocketDisconnect:
        logger.info("Driver %s disconnected", driver_id)
    except Exception as exc:
        logger.error("WebSocket error for %s: %s", driver_id, exc, exc_info=True)
        try:
            await websocket.send_json(
                TrackingResponse(status="error", message="Internal server error").model_dump()
            )
        except Exception:
            pass
    finally:
        active_connections.pop(driver_id, None)
        remove_driver(driver_id)


# ═══════════════════════════════════════════════════════
#  REST — Predictive Route (greedy chain + ORS)
# ═══════════════════════════════════════════════════════


@router.get("/predict-route/{driver_id}")
async def predict_route_endpoint(driver_id: str):
    """
    Predictive routing for a driver BEFORE they start moving.

    1. Reads the driver's current location from in-memory active_drivers.
    2. Chains up to 3 nearest pending orders (greedy nearest-neighbour via PostGIS).
    3. Calls OpenRouteService for the true driving distance & GeoJSON polyline.
    4. Returns ordered stops, total km, duration, and the polyline.
    """
    # Read from in-memory store
    pos = get_driver(driver_id)
    if pos is None:
        raise HTTPException(
            status_code=404,
            detail=f"Driver {driver_id} is not currently tracked. "
                   "Connect via WebSocket first to send your GPS position.",
        )

    try:
        result = await predict_route(
            driver_lat=pos["lat"],
            driver_lng=pos["lng"],
        )
        return result
    except Exception as exc:
        logger.error(
            "predict_route failed for driver %s: %s", driver_id, exc, exc_info=True
        )
        # Graceful fallback: return a valid response with the error
        return {
            "driver": {"lat": pos["lat"], "lng": pos["lng"]},
            "stops": [],
            "total_km": 0.0,
            "duration_min": 0.0,
            "polyline": None,
            "ors_success": False,
            "ors_error": f"Route prediction unavailable: {type(exc).__name__}: {exc}",
            "straight_line_km": 0.0,
        }


# ═══════════════════════════════════════════════════════
#  REST — Active drivers snapshot (for fleet dashboard)
# ═══════════════════════════════════════════════════════


@router.get("/active-drivers")
async def list_active_drivers():
    """Return all currently tracked drivers and their positions."""
    return {
        "count": len(active_drivers),
        "drivers": {
            did: {"lat": pos["lat"], "lng": pos["lng"]}
            for did, pos in active_drivers.items()
        },
    }
