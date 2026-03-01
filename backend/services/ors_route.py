"""
Daladan Platform — OpenRouteService Driving Route Utility
Standalone async function to get driving route + distance between two GPS points.

Usage:
    from backend.services.ors_route import get_driving_route

    result = await get_driving_route(
        origin_lat=41.00, origin_lng=71.67,
        dest_lat=41.31,  dest_lng=69.24,
    )
    # result.distance_km, result.duration_min, result.geometry_geojson, ...

Requires:
    - ORS_API_KEY in .env  (free at https://openrouteservice.org/dev/#/signup)
    - httpx (already in requirements.txt)
"""
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

from backend.config import get_settings

logger = logging.getLogger("daladan.ors_route")

# ═══════════════════════════════════════════════════════
#  Constants
# ═══════════════════════════════════════════════════════

ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car"
REQUEST_TIMEOUT = 10.0  # seconds
MAX_RETRIES = 2


# ═══════════════════════════════════════════════════════
#  Result model
# ═══════════════════════════════════════════════════════


@dataclass
class DrivingRouteResult:
    """Result of a driving route query."""

    success: bool
    distance_km: float = 0.0
    duration_min: float = 0.0
    geometry_geojson: Optional[dict] = None
    bbox: Optional[list[float]] = None
    steps: list[dict] = field(default_factory=list)
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "distance_km": self.distance_km,
            "duration_min": self.duration_min,
            "geometry_geojson": self.geometry_geojson,
            "bbox": self.bbox,
            "steps": self.steps,
            "error": self.error,
        }


# ═══════════════════════════════════════════════════════
#  Main function
# ═══════════════════════════════════════════════════════


async def get_driving_route(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    *,
    api_key: Optional[str] = None,
) -> DrivingRouteResult:
    """
    Get the driving route between two coordinates via OpenRouteService.

    Args:
        origin_lat:  Driver / start latitude  (WGS-84).
        origin_lng:  Driver / start longitude (WGS-84).
        dest_lat:    Order / end latitude     (WGS-84).
        dest_lng:    Order / end longitude    (WGS-84).
        api_key:     Override the ORS API key (defaults to env var).

    Returns:
        DrivingRouteResult with distance_km, duration_min, GeoJSON geometry,
        and optional turn-by-turn steps.

    This function **never raises** — all errors are captured in the result
    so it won't crash the calling backend code.
    """
    # ── Resolve API key ──
    key = api_key or get_settings().ORS_API_KEY
    if not key:
        return DrivingRouteResult(
            success=False,
            error="ORS_API_KEY is not set. Get a free key at "
                  "https://openrouteservice.org/dev/#/signup",
        )

    # ── Build request ──
    # ORS expects coordinates as [lng, lat] (GeoJSON order)
    headers = {
        "Authorization": key,
        "Accept": "application/json, application/geo+json",
        "Content-Type": "application/json",
    }
    body = {
        "coordinates": [
            [origin_lng, origin_lat],
            [dest_lng, dest_lat],
        ],
        "geometry": True,
        "instructions": True,
        "units": "km",
    }

    # ── Send with retries ──
    last_error: Optional[str] = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.post(
                    ORS_DIRECTIONS_URL,
                    headers=headers,
                    json=body,
                )

            # ── Handle HTTP errors ──
            if resp.status_code == 429:
                last_error = (
                    "ORS rate limit exceeded (HTTP 429). "
                    "Free tier allows 40 req/min. Retry later."
                )
                logger.warning("ORS rate-limited (attempt %d/%d)", attempt, MAX_RETRIES)
                continue

            if resp.status_code == 403:
                return DrivingRouteResult(
                    success=False,
                    error="ORS API key is invalid or expired (HTTP 403).",
                )

            if resp.status_code != 200:
                last_error = (
                    f"ORS returned HTTP {resp.status_code}: "
                    f"{resp.text[:200]}"
                )
                logger.error("ORS error (attempt %d): %s", attempt, last_error)
                continue

            # ── Parse response ──
            data = resp.json()
            routes = data.get("routes", [])

            if not routes:
                return DrivingRouteResult(
                    success=False,
                    error="ORS returned no routes for these coordinates.",
                )

            route = routes[0]
            summary = route.get("summary", {})
            geometry = route.get("geometry")
            bbox = route.get("bbox")

            # Extract turn-by-turn steps (if available)
            segments = route.get("segments", [])
            steps = []
            for seg in segments:
                for step in seg.get("steps", []):
                    steps.append({
                        "instruction": step.get("instruction", ""),
                        "distance_km": round(step.get("distance", 0), 2),
                        "duration_s": round(step.get("duration", 0), 1),
                        "type": step.get("type", 0),
                    })

            result = DrivingRouteResult(
                success=True,
                distance_km=round(summary.get("distance", 0), 2),
                duration_min=round(summary.get("duration", 0) / 60, 1),
                geometry_geojson=geometry,
                bbox=bbox,
                steps=steps,
            )

            logger.info(
                "ORS route: (%.4f,%.4f) → (%.4f,%.4f) = %.1f km, %.0f min",
                origin_lat, origin_lng, dest_lat, dest_lng,
                result.distance_km, result.duration_min,
            )
            return result

        except httpx.TimeoutException:
            last_error = f"ORS request timed out after {REQUEST_TIMEOUT}s (attempt {attempt})"
            logger.warning(last_error)
            continue

        except httpx.RequestError as exc:
            last_error = f"ORS network error: {exc} (attempt {attempt})"
            logger.warning(last_error)
            continue

        except Exception as exc:
            last_error = f"Unexpected ORS error: {exc}"
            logger.error(last_error, exc_info=True)
            break

    # All retries exhausted
    return DrivingRouteResult(success=False, error=last_error)
