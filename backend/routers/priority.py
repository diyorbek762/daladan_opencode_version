"""
Daladan Platform — Priority Order Pool Router
Gamified order access based on leaderboard tier.
"""
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import DealGroup, DealStatus, User

logger = logging.getLogger("daladan.priority")

router = APIRouter(prefix="/api", tags=["Priority Pool"])


# ═══════════════════════════════════════════════════════
#  Leaderboard view map by role
# ═══════════════════════════════════════════════════════

LEADERBOARD_VIEW = {
    "producer": "producer_leaderboard",
    "driver": "driver_leaderboard",
    "retailer": "retailer_leaderboard",
}


# ═══════════════════════════════════════════════════════
#  GET /orders/priority-pool — Tier-based deal access
# ═══════════════════════════════════════════════════════


@router.get("/orders/priority-pool")
async def get_priority_pool(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return OPEN (NEGOTIATING) deals filtered by the user's leaderboard tier.

    Tier 1 (top 10%):  all deals immediately.
    Tier 2 (10–50%):   deals created > 5 minutes ago.
    Tier 3 (bottom 50%): deals created > 15 minutes ago.
    """
    role_value = current_user.role.value
    view_name = LEADERBOARD_VIEW.get(role_value)

    if not view_name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{role_value}' does not have a leaderboard.",
        )

    # ── Determine user's rank and total users ──
    user_rank = None
    total_users = 1  # default to avoid division by zero

    try:
        # Get user rank
        rank_result = await db.execute(
            text(f"SELECT rank FROM {view_name} WHERE user_id = :uid"),
            {"uid": current_user.id},
        )
        row = rank_result.mappings().first()
        if row:
            user_rank = int(row["rank"])

        # Get total users in leaderboard
        count_result = await db.execute(
            text(f"SELECT COUNT(*) AS cnt FROM {view_name}")
        )
        count_row = count_result.mappings().first()
        if count_row:
            total_users = max(int(count_row["cnt"]), 1)

    except Exception as e:
        logger.warning("Leaderboard query failed: %s", e)

    # ── Determine tier-based time delay ──
    if user_rank and total_users > 0:
        percentile = user_rank / total_users
    else:
        # Unranked users get the lowest tier
        percentile = 1.0

    now = datetime.utcnow()

    if percentile <= 0.10:
        # Tier 1: top 10% — no delay
        cutoff = None
        tier = 1
    elif percentile <= 0.50:
        # Tier 2: 10–50% — 5 minute delay
        cutoff = now - timedelta(minutes=5)
        tier = 2
    else:
        # Tier 3: bottom 50% — 15 minute delay
        cutoff = now - timedelta(minutes=15)
        tier = 3

    # ── Query deals ──
    query = select(DealGroup).where(
        DealGroup.status == DealStatus.NEGOTIATING,
    )

    if cutoff:
        query = query.where(DealGroup.created_at <= cutoff)

    query = query.order_by(DealGroup.created_at.desc())

    result = await db.execute(query)
    deals = result.scalars().all()

    logger.info(
        "🎯 Priority pool: user=%s tier=%d rank=%s/%d — returning %d deals",
        current_user.id, tier, user_rank, total_users, len(deals),
    )

    return {
        "tier": tier,
        "rank": user_rank,
        "total_users": total_users,
        "deals": [
            {
                "id": str(deal.id),
                "deal_number": deal.deal_number,
                "title": deal.title,
                "status": deal.status.value,
                "agreed_price_per_kg": (
                    float(deal.agreed_price_per_kg)
                    if deal.agreed_price_per_kg else None
                ),
                "agreed_quantity_kg": (
                    float(deal.agreed_quantity_kg)
                    if deal.agreed_quantity_kg else None
                ),
                "created_at": deal.created_at.isoformat() if deal.created_at else None,
            }
            for deal in deals
        ],
    }
