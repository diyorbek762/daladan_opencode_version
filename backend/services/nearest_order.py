"""
Daladan Platform — Nearest-Order Service
Decoupled greedy nearest-neighbour algorithm that queries PostGIS
for the closest unassigned orders to a given GPS coordinate.

Usage:
    from backend.services.nearest_order import find_nearest_unassigned_order

    async with async_session() as session:
        orders = await find_nearest_unassigned_order(session, lat=41.31, lng=69.28)
"""
import logging
from uuid import UUID

from geoalchemy2.functions import ST_Distance, ST_X, ST_Y, ST_SetSRID, ST_MakePoint
from geoalchemy2 import Geography
from sqlalchemy import select, cast, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import DealGroup, DealStatus
from backend.schemas.tracking import NearestOrderResult

logger = logging.getLogger("daladan.nearest_order")

# ── Earth constants ──
METERS_PER_KM = 1000.0


async def find_nearest_unassigned_order(
    session: AsyncSession,
    lat: float,
    lng: float,
    limit: int = 5,
    radius_km: float = 100.0,
) -> list[NearestOrderResult]:
    """
    Greedy nearest-neighbour query: find the closest unassigned orders
    to the driver's current GPS position.

    This function is **fully decoupled** — it only needs a DB session
    and coordinates. Import it from any router or service.

    Args:
        session:    An async SQLAlchemy session.
        lat:        Driver latitude  (WGS-84, EPSG:4326).
        lng:        Driver longitude (WGS-84, EPSG:4326).
        limit:      Maximum number of results to return (default 5).
        radius_km:  Search radius in kilometres (default 100 km).

    Returns:
        A list of NearestOrderResult, ordered by distance ascending.
    """
    # Build a PostGIS point for the driver's position
    driver_point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)

    # Distance in metres via geography cast (accurate on the sphere)
    distance_expr = ST_Distance(
        cast(DealGroup.pickup_location, Geography),
        cast(driver_point, Geography),
    ).label("distance_m")

    stmt = (
        select(
            DealGroup.id,
            DealGroup.deal_number,
            DealGroup.title,
            ST_X(DealGroup.pickup_location).label("pickup_lng"),
            ST_Y(DealGroup.pickup_location).label("pickup_lat"),
            distance_expr,
        )
        .where(
            # Only orders that are open for assignment
            DealGroup.status == DealStatus.NEGOTIATING,
            # No driver assigned yet
            DealGroup.driver_id.is_(None),
            # Has a pickup location set
            DealGroup.pickup_location.isnot(None),
            # Within the search radius (convert km → m)
            ST_Distance(
                cast(DealGroup.pickup_location, Geography),
                cast(driver_point, Geography),
            )
            <= radius_km * METERS_PER_KM,
        )
        .order_by("distance_m")  # greedy: closest first
        .limit(limit)
    )

    result = await session.execute(stmt)
    rows = result.all()

    orders: list[NearestOrderResult] = []
    for row in rows:
        orders.append(
            NearestOrderResult(
                deal_id=str(row.id),
                deal_number=row.deal_number,
                title=row.title,
                distance_km=round(row.distance_m / METERS_PER_KM, 2),
                pickup_lat=row.pickup_lat,
                pickup_lng=row.pickup_lng,
            )
        )

    logger.info(
        "Nearest-order query at (%.4f, %.4f): found %d orders within %.0f km",
        lat,
        lng,
        len(orders),
        radius_km,
    )
    return orders
