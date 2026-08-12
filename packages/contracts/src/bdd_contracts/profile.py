"""Profiler output schemas. Profiles are deterministic facts about a
dataset - never LLM narratives.
"""

from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["info", "low", "medium", "high"]


class ColumnProfile(BaseModel):
    name: str
    dtype: str = Field(description="Detected data type (polars dtype string)")
    null_count: int
    null_ratio: float = Field(ge=0.0, le=1.0)
    unique_count: int
    min_value: float | str | None = None
    max_value: float | str | None = None
    mean: float | None = None
    stddev: float | None = None
    top_values: list[dict] = Field(
        default_factory=list, description="Top value/value_count pairs"
    )
    sample_values: list[str] = Field(default_factory=list, max_length=5)


class QualityObservation(BaseModel):
    code: str = Field(description="Stable issue code, e.g. DUPLICATE_ROWS")
    severity: Severity = "info"
    column: str | None = None
    description: str
    evidence: dict = Field(
        default_factory=dict, description="Reproducible numbers backing the issue"
    )


class DatasetProfile(BaseModel):
    dataset_id: str
    artifact_id: str
    row_count: int
    column_count: int
    columns: list[ColumnProfile]
    duplicate_rows: int
    quality_observations: list[QualityObservation] = Field(default_factory=list)
    candidate_keys: list[list[str]] = Field(default_factory=list)
    profile_version: str = "0.1.0"