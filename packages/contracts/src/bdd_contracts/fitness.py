"""Data Fitness Score contract (spec engine 14).

Deterministic 0-100 score describing how fit an artifact is for forensic
comparison. The score summarizes profiling observations; it never asserts
correctness of the underlying facts.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

FitnessGrade = Literal["A", "B", "C", "D", "F"]


class FitnessComponent(BaseModel):
    """One weighted component of the overall fitness score."""

    name: str
    score: float = Field(ge=0, le=100)
    weight: float = Field(gt=0)
    detail: str


class FitnessScore(BaseModel):
    """Composite fitness score with full component breakdown."""

    artifact_id: str
    score: float = Field(ge=0, le=100)
    grade: FitnessGrade
    components: list[FitnessComponent]
    computed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
