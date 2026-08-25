"""False Consensus Detection contract (spec engine 10, section 10.3).

Several pages repeating a number are not independent confirmation if they
trace to the same origin. This contract reports *evidence diversity*, never
raw source count.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

from bdd_contracts.finding import ConfidenceLevel, SeverityLevel

ConsensusVerdict = Literal["independent_corroboration", "shared_origin_suspected"]


class OriginGroup(BaseModel):
    """One distinct origin plus every claim that traces back to it."""

    origin_artifact_id: str
    members: list[str]


class ConsensusFinding(BaseModel):
    finding_id: str
    metric: str
    apparent_sources: int = Field(ge=1)
    distinct_origins: int = Field(ge=1)
    diversity_ratio: float = Field(ge=0, le=1)
    verdict: ConsensusVerdict
    origin_groups: list[OriginGroup]
    severity: SeverityLevel
    confidence: ConfidenceLevel
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
