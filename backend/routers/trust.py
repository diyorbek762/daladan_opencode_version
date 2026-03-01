"""
Daladan Platform — Trust Router
Endpoints for user documents, ratings, contacts, and trust profile retrieval.
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import (
    DealGroup,
    User,
    UserContact,
    UserDocument,
    UserRating,
)
from backend.schemas.trust import (
    ContactCreate,
    ContactResponse,
    DocumentCreate,
    DocumentResponse,
    RatingCreate,
    RatingResponse,
    UserTrustProfileDTO,
)

logger = logging.getLogger("daladan.trust")

router = APIRouter(prefix="/api/trust", tags=["Trust & Ratings"])


# ═══════════════════════════════════════════════════════
#  Leaderboard view map by role
# ═══════════════════════════════════════════════════════

LEADERBOARD_VIEW = {
    "producer": "producer_leaderboard",
    "driver": "driver_leaderboard",
    "retailer": "retailer_leaderboard",
}


# ═══════════════════════════════════════════════════════
#  POST /users/{user_id}/documents — Upload a document
# ═══════════════════════════════════════════════════════


@router.post(
    "/users/{user_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_document(
    user_id: UUID,
    body: DocumentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a new document record for a user."""
    # Only the user themselves can upload to their profile
    if str(current_user.id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only upload documents to your own profile.",
        )

    doc = UserDocument(
        user_id=user_id,
        file_url=body.file_url,
        document_type=body.document_type,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    logger.info("📄 Document added for user %s: %s", user_id, body.document_type)
    return DocumentResponse(
        id=str(doc.id),
        file_url=doc.file_url,
        document_type=doc.document_type,
        is_verified=doc.is_verified,
        created_at=doc.created_at,
    )


# ═══════════════════════════════════════════════════════
#  POST /orders/{deal_group_id}/rate — Submit a rating
# ═══════════════════════════════════════════════════════


@router.post(
    "/orders/{deal_group_id}/rate",
    response_model=RatingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_rating(
    deal_group_id: UUID,
    body: RatingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a rating for another user after a deal is completed."""
    # Verify the deal exists
    result = await db.execute(
        select(DealGroup).where(DealGroup.id == deal_group_id)
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal group not found.",
        )

    # Verify the reviewing user participated in this deal
    deal_participants = {
        str(deal.seller_id),
        str(deal.buyer_id),
        str(deal.driver_id),
    }
    if str(current_user.id) not in deal_participants:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only rate deals you participated in.",
        )

    # Cannot rate yourself
    if str(current_user.id) == str(body.reviewee_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot rate yourself.",
        )

    # Check for duplicate rating
    existing = await db.execute(
        select(UserRating).where(
            UserRating.reviewer_id == current_user.id,
            UserRating.deal_group_id == deal_group_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already rated this deal.",
        )

    rating = UserRating(
        reviewer_id=current_user.id,
        reviewee_id=body.reviewee_id,
        deal_group_id=deal_group_id,
        score=body.score,
        on_time=body.on_time,
        as_described=body.as_described,
    )
    db.add(rating)
    await db.flush()
    await db.refresh(rating)

    # Refresh materialized leaderboards
    try:
        await db.execute(text("SELECT refresh_leaderboards()"))
    except Exception as e:
        logger.warning("Could not refresh leaderboards: %s", e)

    logger.info(
        "⭐ Rating %d★ submitted by %s for %s on deal %s",
        body.score, current_user.id, body.reviewee_id, deal_group_id,
    )
    return RatingResponse(
        id=str(rating.id),
        reviewer_id=str(rating.reviewer_id),
        reviewee_id=str(rating.reviewee_id),
        deal_group_id=str(rating.deal_group_id),
        score=rating.score,
        on_time=rating.on_time,
        as_described=rating.as_described,
        created_at=rating.created_at,
    )


# ═══════════════════════════════════════════════════════
#  PUT /users/{user_id}/contacts — Upsert a contact
# ═══════════════════════════════════════════════════════


@router.put(
    "/users/{user_id}/contacts",
    response_model=ContactResponse,
)
async def upsert_contact(
    user_id: UUID,
    body: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add or update a user's contact information."""
    if str(current_user.id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own contacts.",
        )

    # Check if contact already exists for this type
    result = await db.execute(
        select(UserContact).where(
            UserContact.user_id == user_id,
            UserContact.contact_type == body.contact_type,
        )
    )
    contact = result.scalar_one_or_none()

    if contact:
        # Update existing
        contact.contact_value = body.contact_value
        contact.is_public = body.is_public
    else:
        # Create new
        contact = UserContact(
            user_id=user_id,
            contact_type=body.contact_type,
            contact_value=body.contact_value,
            is_public=body.is_public,
        )
        db.add(contact)

    await db.flush()
    await db.refresh(contact)

    logger.info("📇 Contact %s updated for user %s", body.contact_type, user_id)
    return ContactResponse(
        id=str(contact.id),
        contact_type=contact.contact_type,
        contact_value=contact.contact_value,
        is_public=contact.is_public,
        created_at=contact.created_at,
    )


# ═══════════════════════════════════════════════════════
#  GET /users/{user_id}/trust-profile — Full trust profile
# ═══════════════════════════════════════════════════════


@router.get(
    "/users/{user_id}/trust-profile",
    response_model=UserTrustProfileDTO,
)
async def get_trust_profile(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch the user's full trust profile:
    leaderboard rank, trust score, verified documents, and public contacts.
    """
    # Fetch user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # Determine role and leaderboard view
    role_value = user.role.value
    view_name = LEADERBOARD_VIEW.get(role_value)

    trust_score = 0.0
    leaderboard_rank = 0
    total_ratings = 0
    avg_score = 0.0

    if view_name:
        try:
            lb_result = await db.execute(
                text(
                    f"SELECT trust_score, rank, total_ratings, avg_score "
                    f"FROM {view_name} WHERE user_id = :uid"
                ),
                {"uid": user_id},
            )
            row = lb_result.mappings().first()
            if row:
                trust_score = float(row["trust_score"])
                leaderboard_rank = int(row["rank"])
                total_ratings = int(row["total_ratings"])
                avg_score = float(row["avg_score"])
        except Exception as e:
            logger.warning("Leaderboard query failed for %s: %s", user_id, e)

    # Verified documents
    doc_result = await db.execute(
        select(UserDocument).where(
            UserDocument.user_id == user_id,
            UserDocument.is_verified == True,  # noqa: E712
        )
    )
    docs = doc_result.scalars().all()

    # Public contacts
    contact_result = await db.execute(
        select(UserContact).where(
            UserContact.user_id == user_id,
            UserContact.is_public == True,  # noqa: E712
        )
    )
    contacts = contact_result.scalars().all()

    return UserTrustProfileDTO(
        user_id=str(user.id),
        full_name=user.full_name,
        role=role_value,
        region=user.region,
        trust_score=trust_score,
        leaderboard_rank=leaderboard_rank,
        total_ratings=total_ratings,
        avg_score=avg_score,
        documents=[
            DocumentResponse(
                id=str(d.id),
                file_url=d.file_url,
                document_type=d.document_type,
                is_verified=d.is_verified,
                created_at=d.created_at,
            )
            for d in docs
        ],
        contacts=[
            ContactResponse(
                id=str(c.id),
                contact_type=c.contact_type,
                contact_value=c.contact_value,
                is_public=c.is_public,
                created_at=c.created_at,
            )
            for c in contacts
        ],
    )
