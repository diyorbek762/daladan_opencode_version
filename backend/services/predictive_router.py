"""
Daladan Platform — Predictive Router Service
Chains up to 3 nearest unassigned orders using a greedy nearest-neighbor
algorithm, then fetches the true driving route via OpenRouteService.

Usage:
    from backend.services.predictive_router import predict_route

    result = await predict_route(driver_lat=41.00, driver_lng=71.67)
    # result["stops"], result["total_km"], result["polyline"], ...
"""
import logging
import math
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import async_session
from backend.services.nearest_order import find_nearest_unassigned_order
from backend.services.ors_route import get_driving_route, ORS_DIRECTIONS_URL
from backend.config import get_settings

import httpx

logger = logging.getLogger("daladan.predictive_router")

# ═══════════════════════════════════════════════════════
#  Constants
# ═══════════════════════════════════════════════════════

MAX_CHAINED_ORDERS = 3
SEARCH_RADIUS_KM = 80.0
EARTH_RADIUS_KM = 6371.0
REQUEST_TIMEOUT = 12.0


# ═══════════════════════════════════════════════════════
#  Haversine
# ═══════════════════════════════════════════════════════


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two GPS points."""
    r = math.radians
    dlat = r(lat2 - lat1)
    dlng = r(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(r(lat1)) * math.cos(r(lat2)) * math.sin(dlng / 2) ** 2
    )
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ═══════════════════════════════════════════════════════
#  Greedy order chaining
# ═══════════════════════════════════════════════════════


async def _chain_nearest_orders(
    session: AsyncSession,
    start_lat: float,
    start_lng: float,
) -> list[dict]:
    """
    Greedy nearest-neighbour chaining: starting from the driver's position,
    find the closest pending order, then from that order's pickup find the
    next closest, up to MAX_CHAINED_ORDERS total.

    Returns a list of stop dicts: [{deal_id, title, lat, lng, distance_km, type}, ...]
    """
    stops: list[dict] = []
    used_ids: set[str] = set()
    cursor_lat, cursor_lng = start_lat, start_lng

    for i in range(MAX_CHAINED_ORDERS):
        # Query nearest orders from the current cursor position
        candidates = await find_nearest_unassigned_order(
            session,
            lat=cursor_lat,
            lng=cursor_lng,
            limit=10,
            radius_km=SEARCH_RADIUS_KM,
        )

        # Filter out already-chained orders
        candidates = [c for c in candidates if c.deal_id not in used_ids]

        if not candidates:
            break

        best = candidates[0]
        used_ids.add(best.deal_id)

        stops.append({
            "order": i + 1,
            "type": "pickup",
            "deal_id": best.deal_id,
            "deal_number": best.deal_number,
            "title": best.title,
            "lat": best.pickup_lat,
            "lng": best.pickup_lng,
            "distance_from_prev_km": best.distance_km,
        })

        # Move cursor to this order's pickup for the next iteration
        cursor_lat, cursor_lng = best.pickup_lat, best.pickup_lng

    return stops


# ═══════════════════════════════════════════════════════
#  Multi-waypoint ORS request
# ═══════════════════════════════════════════════════════


async def _get_multi_waypoint_route(
    coordinates: list[tuple[float, float]],
) -> dict:
    """
    Call ORS with multiple waypoints: [(lng1,lat1), (lng2,lat2), ...].
    Returns the full route with total distance, duration, and GeoJSON polyline.
    Falls back gracefully if ORS is unavailable.
    """
    key = get_settings().ORS_API_KEY
    if not key:
        # Fallback: compute straight-line total
        total_km = 0.0
        for i in range(len(coordinates) - 1):
            lng1, lat1 = coordinates[i]
            lng2, lat2 = coordinates[i + 1]
            total_km += haversine(lat1, lng1, lat2, lng2)

        return {
            "success": False,
            "distance_km": round(total_km, 2),
            "duration_min": round(total_km / 40 * 60, 1),  # ~40 km/h estimate
            "polyline": None,
            "error": "ORS_API_KEY not set — showing straight-line estimate.",
        }

    headers = {
        "Authorization": key,
        "Accept": "application/json, application/geo+json",
        "Content-Type": "application/json",
    }
    body = {
        "coordinates": [list(c) for c in coordinates],  # [[lng, lat], ...]
        "geometry": True,
        "instructions": False,
        "units": "km",
    }

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(ORS_DIRECTIONS_URL, headers=headers, json=body)

        if resp.status_code == 429:
            return {
                "success": False,
                "distance_km": 0,
                "duration_min": 0,
                "polyline": None,
                "error": "ORS rate limit exceeded. Try again later.",
            }

        if resp.status_code != 200:
            return {
                "success": False,
                "distance_km": 0,
                "duration_min": 0,
                "polyline": None,
                "error": f"ORS HTTP {resp.status_code}: {resp.text[:200]}",
            }

        data = resp.json()
        routes = data.get("routes", [])
        if not routes:
            return {
                "success": False,
                "distance_km": 0,
                "duration_min": 0,
                "polyline": None,
                "error": "ORS returned no routes.",
            }

        route = routes[0]
        summary = route.get("summary", {})

        return {
            "success": True,
            "distance_km": round(summary.get("distance", 0), 2),
            "duration_min": round(summary.get("duration", 0) / 60, 1),
            "polyline": route.get("geometry"),
            "error": None,
        }

    except httpx.TimeoutException:
        return {
            "success": False, "distance_km": 0, "duration_min": 0,
            "polyline": None, "error": "ORS request timed out.",
        }
    except Exception as exc:
        logger.error("ORS multi-waypoint error: %s", exc, exc_info=True)
        return {
            "success": False, "distance_km": 0, "duration_min": 0,
            "polyline": None, "error": f"ORS error: {exc}",
        }


# ═══════════════════════════════════════════════════════
#  Main predict_route function
# ═══════════════════════════════════════════════════════


async def predict_route(
    driver_lat: float,
    driver_lng: float,
) -> dict:
    """
    Full predictive routing pipeline:
      1. Chain up to 3 nearest pending orders (greedy nearest-neighbour)
      2. Build waypoint list: driver → pickup1 → pickup2 → pickup3
      3. Call ORS for true driving distance + GeoJSON polyline
      4. Return the complete prediction

    Returns a JSON-serializable dict with stops, total_km, duration_min,
    polyline (GeoJSON), and any errors.
    """
    async with async_session() as session:
        stops = await _chain_nearest_orders(session, driver_lat, driver_lng)

    if not stops:
        return {
            "driver": {"lat": driver_lat, "lng": driver_lng},
            "stops": [],
            "total_km": 0.0,
            "duration_min": 0.0,
            "polyline": None,
            "ors_error": None,
            "message": "No pending orders found within range.",
        }

    # Build ORS waypoint list: [driver, stop1, stop2, ...]
    # ORS expects [lng, lat] order
    waypoints: list[tuple[float, float]] = [(driver_lng, driver_lat)]
    for stop in stops:
        waypoints.append((stop["lng"], stop["lat"]))

    # Get real driving route from ORS
    ors_result = await _get_multi_waypoint_route(waypoints)

    # Compute straight-line total as fallback comparison
    straight_line_km = 0.0
    for stop in stops:
        straight_line_km += stop["distance_from_prev_km"]

    return {
        "driver": {"lat": driver_lat, "lng": driver_lng},
        "stops": stops,
        "total_km": ors_result["distance_km"] or round(straight_line_km, 2),
        "duration_min": ors_result["duration_min"] or round(straight_line_km / 40 * 60, 1),
        "polyline": ors_result.get("polyline"),
        "ors_success": ors_result["success"],
        "ors_error": ors_result.get("error"),
        "straight_line_km": round(straight_line_km, 2),
    }
