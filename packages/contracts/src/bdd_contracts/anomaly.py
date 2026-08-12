"""Forensic engine output schemas (spec section 9 engines 7-8)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field

SeverityLevel = Literal["info", "low", "medium", "high", "critical"]
ConfidenceLevel = Literal["low", "moderate", "high"]


class AnomalyFinding(BaseModel):
    """Statistical anomaly result. Facts only - no causal claims."""

    finding_id: str
    metric: str = Field(description="Canonical measure, e.g. beneficiary_count")
    slice: dict = Field(
        default_factory=dict,
        description="Dimensions the anomaly holds over, e.g. district, year",
    )
    observed: float
    expected: float | None = None
    baseline: float | None = None
    method: str = Field(description="e.g. zscore, iqr, yoy_change")
    score: float | None = None
    severity: SeverityLevel = "info"
    confidence: ConfidenceLevel = "low"
    evidence_query: str = Field(description="Reproducible query describing detection")
    caveats: list[str] = Field(
        default_factory=list,
        description="Known explanation candidates, not conclusions",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ContradictionFinding(BaseModel):
    """Cross-source contradiction result. Reconciliation outcome of two claims."""

    finding_id: str
    claim_a: dict = Field(description="source_id, value, definition, locator")
    claim_b: dict = Field(description="source_id, value, definition, locator")
    reconciliation_status: Literal["conflict", "explainable", "not_comparable"] = (
        "explainable"
    )
    delta: float | None = Field(default=None, description="Normalized difference")
    alignment_tests: dict = Field(
        default_factory=dict,
        description="Per-dimension comparability gate outcomes",
    )
    possible_explanations: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(
        default_factory=list, description="Artifact + locator references"
    )
    severity: SeverityLevel = "info"
    confidence: ConfidenceLevel = "low"
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class DriftFinding(BaseModel):
    """Semantic drift between two DefinitionCard versions (spec 10.1)."""

    finding_id: str
    concept_id: str
    before_definition: str
    after_definition: str
    drift_type: Literal["definition", "unit", "denominator", "scope", "geography"] | None = None
    impact_scope: str | None = Field(
        default=None, description="Which comparisons become non-comparable"
    )
    comparability_decision: Literal["comparable", "partial", "not_comparable"] = (
        "not_comparable"
    )
    evidence: list[str] = Field(default_factory=list)
    severity: SeverityLevel = "info"
    semantic_impact: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="0-1 impact on comparability; derived from the drifted dimension, not string diff",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))