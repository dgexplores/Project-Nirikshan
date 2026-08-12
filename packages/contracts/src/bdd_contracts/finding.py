"""Finding, claim and evidence reference schemas (spec section 11.3)."""

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

SeverityLevel = Literal["info", "low", "medium", "high", "critical"]
ConfidenceLevel = Literal["low", "moderate", "high"]
ClaimState = Literal[
    "observed", "inferred", "reconciled", "unresolved", "verified_by_authority"
]


class EvidenceRef(BaseModel):
    evidence_id: str
    artifact_id: str
    locator: str = Field(description="Row/aggregate/page locator within artifact")
    hash: str | None = None


class Claim(BaseModel):
    claim_text: str
    state: ClaimState = "observed"
    asserted_in: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)
    same_origin_as: list[str] = Field(default_factory=list)


class Finding(BaseModel):
    finding_id: str
    finding_type: str
    status: Literal["open", "needs_source_clarification", "resolved",
                    "not_detectable", "false_positive_after_review"] = "open"
    severity: SeverityLevel = "info"
    confidence: ConfidenceLevel = "low"
    claim_text: str = Field(
        description="Safe wording: potential inconsistency requiring verification"
    )
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    repro_recipe_id: str | None = None
    alternative_explanations: list[str] = Field(default_factory=list)
    human_review_required: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))