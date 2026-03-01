"""
Daladan Platform — Trust & Rating Pydantic Schemas
Request/response models for ratings, documents, contacts, and trust profile.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ═══════════════════════════════════════════════════════
#  Rating Schemas
# ═══════════════════════════════════════════════════════


class RatingCreate(BaseModel):
    """Input for submitting a post-handshake rating."""

    model_config = {"extra": "forbid"}

    reviewee_id: UUID = Field(..., description="UUID of the user being rated")
    score: int = Field(..., ge=1, le=5, description="Rating score (1–5 stars)")
    on_time: bool = Field(True, description="Was the delivery/pickup on time?")
    as_described: bool = Field(True, description="Was the product as described?")

    @field_validator("score")
    @classmethod
    def score_in_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Score must be between 1 and 5")
        return v


class RatingResponse(BaseModel):
    """Output for a completed rating record."""

    id: str
    reviewer_id: str
    reviewee_id: str
    deal_group_id: str
    score: int
    on_time: bool
    as_described: bool
    created_at: datetime


# ═══════════════════════════════════════════════════════
#  Document Schemas
# ═══════════════════════════════════════════════════════


class DocumentCreate(BaseModel):
    """Input for uploading a document URL."""

    model_config = {"extra": "forbid"}

    file_url: str = Field(..., max_length=500, description="URL of the uploaded document")
    document_type: str = Field(
        ...,
        max_length=50,
        description="Type of document (e.g. 'license', 'certificate', 'passport')",
    )


class DocumentResponse(BaseModel):
    """Output for a document record."""

    id: str
    file_url: str
    document_type: str
    is_verified: bool
    created_at: datetime


# ═══════════════════════════════════════════════════════
#  Contact Schemas
# ═══════════════════════════════════════════════════════


class ContactCreate(BaseModel):
    """Input for adding/updating a contact method."""

    model_config = {"extra": "forbid"}

    contact_type: str = Field(
        ...,
        max_length=30,
        description="Contact type: 'telegram', 'whatsapp', 'phone', 'website'",
    )
    contact_value: str = Field(
        ...,
        max_length=255,
        description="Contact value (e.g. '@username', '+998901234567', 'https://...')",
    )
    is_public: bool = Field(True, description="Whether this contact is publicly visible")

    @field_validator("contact_type")
    @classmethod
    def validate_contact_type(cls, v: str) -> str:
        allowed = {"telegram", "whatsapp", "phone", "website"}
        if v.lower() not in allowed:
            raise ValueError(f"contact_type must be one of: {', '.join(sorted(allowed))}")
        return v.lower()


class ContactResponse(BaseModel):
    """Output for a contact record."""

    id: str
    contact_type: str
    contact_value: str
    is_public: bool
    created_at: datetime


# ═══════════════════════════════════════════════════════
#  Trust Profile DTO
# ═══════════════════════════════════════════════════════


class UserTrustProfileDTO(BaseModel):
    """Combined trust profile: user info + score + rank + docs + contacts."""

    user_id: str
    full_name: str
    role: str
    region: Optional[str] = None
    trust_score: float = Field(0.0, description="Weighted trust score (0–100)")
    leaderboard_rank: int = Field(0, description="Rank in role-specific leaderboard")
    total_ratings: int = Field(0, description="Total number of ratings received")
    avg_score: float = Field(0.0, description="Average rating score (1–5)")
    documents: list[DocumentResponse] = Field(default_factory=list)
    contacts: list[ContactResponse] = Field(default_factory=list)
