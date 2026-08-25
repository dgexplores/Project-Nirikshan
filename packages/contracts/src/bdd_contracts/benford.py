"""Benford's Law contract (forensic digit analysis).

First-digit frequencies of naturally occurring numeric populations follow
log10(1 + 1/d). Significant deviation is a screening signal for fabricated,
manipulated or wrongly-scaled numbers - a review trigger, never proof.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

BenfordConformity = Literal["close", "acceptable", "marginal", "nonconformity"]


class DigitDeviation(BaseModel):
    """Observed vs expected share for one leading digit."""

    digit: int = Field(ge=1, le=9)
    observed_share: float = Field(ge=0, le=1)
    expected_share: float = Field(ge=0, le=1)
    excess: float  # observed - expected; positive means over-represented


class BenfordFinding(BaseModel):
    finding_id: str
    column: str
    n_values: int = Field(gt=0)
    mad: float = Field(ge=0)  # mean absolute deviation vs Benford expectation
    conformity: BenfordConformity
    digits: list[DigitDeviation]
    caveats: list[str]
    severity: Literal["info", "low", "medium", "high", "critical"] = "medium"
    confidence: Literal["low", "moderate", "high"] = "moderate"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
