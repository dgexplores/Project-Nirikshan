"""Semantic foundation schemas (spec section 9 engines 3-6).

Schema Mapping, Definition Card, Geographic Resolution, Temporal
Resolution and Unit Normalization. These capture *meaning* and
comparability decisions, never LLM narrative.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

ApprovalStatus = Literal["proposed", "approved", "rejected", "pending_review"]
MatchMethod = Literal["exact", "fuzzy", "alias", "manual", "rule"]


class SchemaMapping(BaseModel):
    """Maps one raw field to a canonical concept with evidence."""

    mapping_id: str
    artifact_id: str
    raw_field: str
    canonical_field: str
    transform: str = Field(
        description="Stable transform name, e.g. strip_whitespace, lower_case"
    )
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str] = Field(
        default_factory=list, description="Source spans / reasons for the mapping"
    )
    approval_status: ApprovalStatus = "proposed"


class UnresolvedField(BaseModel):
    artifact_id: str
    raw_field: str
    reason: str = Field(description="Why no canonical field was assigned")


class DefinitionCard(BaseModel):
    """Operational definition of a concept (spec 10.1, semantic engine)."""

    card_id: str
    concept_id: str
    operational_definition: str
    scope: str | None = Field(
        default=None, description="Population, geography or programme scope"
    )
    denominator: str | None = None
    unit: str | None = None
    evidence_spans: list[str] = Field(
        default_factory=list, description="Source document spans defining this"
    )
    ambiguity_flags: list[str] = Field(default_factory=list)
    valid_from: date | None = None
    valid_until: date | None = None
    approval_status: ApprovalStatus = "proposed"


class GeoResolution(BaseModel):
    resolution_id: str
    raw_value: str
    canonical_code: str | None = None
    canonical_name: str | None = None
    level: Literal["country", "state", "district", "subdistrict", "village"] | None = None
    boundary_version: str | None = Field(
        default=None, description="Admin boundary vintage, e.g. 2011-census"
    )
    match_method: MatchMethod = "exact"
    confidence: float = Field(ge=0.0, le=1.0)
    alternatives: list[str] = Field(default_factory=list)


class TemporalResolution(BaseModel):
    resolution_id: str
    raw_text: str = Field(description="Raw period label, e.g. FY 2024-25")
    event_period: tuple[date, date] | None = None
    fiscal_year: str | None = None
    granularity: Literal["year", "fiscal_year", "quarter", "month", "day"] | None = None
    timezone: str | None = None
    comparability_flags: list[str] = Field(
        default_factory=list,
        description="e.g. calendar_vs_fiscal, boundary_change, partial_year",
    )


class UnitNorm(BaseModel):
    """Normalized measure bases typically found in Indian public data."""

    raw_value: float
    raw_unit: str
    canonical_unit: str
    multiplier: float = Field(
        description="raw_value * multiplier = value in canonical_unit"
    )
    base: str = Field(description="Base unit, e.g. count, INR, hectare")

    @property
    def normalized_value(self) -> float:
        return self.raw_value * self.multiplier