"""Canonical observation record (spec section 11.2)."""

from pydantic import BaseModel, Field


class Measure(BaseModel):
    concept_id: str
    raw_value: str
    normalized_value: float | int | None = None
    unit: str | None = None
    denominator: str | None = None


class ObservationRecord(BaseModel):
    observation_id: str
    artifact_id: str
    raw_locator: dict = Field(description="Row/column/file locator in raw artifact")
    dimensions: dict = Field(
        default_factory=dict,
        description="geo_code, period, scheme and other slice keys"
    )
    measure: Measure | None = None
    transform_ids: list[str] = Field(default_factory=list)
    quality_flags: list[str] = Field(default_factory=list)