"""Profiler output schemas. Profiles are deterministic facts about a
dataset - never LLM narratives.
"""

from typing import Literal

from pydantic import BaseModel, Field, computed_field

Severity = Literal["info", "low", "medium", "high"]


PII_TYPE = Literal[
    "aadhaar",
    "pan",
    "mobile_phone",
    "email",
    "bank_account",
    "passport",
    "voter_id",
]


class PiiHint(BaseModel):
    hint_type: PII_TYPE
    column: str
    matched_values: int = Field(gt=0)
    sample_matches: list[str] = Field(default_factory=list, max_length=3)


class Distribution(BaseModel):
    p5: float | None = None
    p25: float | None = None
    p50: float | None = None
    p75: float | None = None
    p95: float | None = None
    skewness: float | None = None


# Numeric columns that are labels rather than measurements. An identifier or a
# calendar part has no expected distribution to violate: a record's id varying
# widely, or a day-of-month landing on the 28th, is not evidence of anything.
# Running statistical checks on them produces confident-looking, meaningless
# findings. Found via a real 47M-row AI Kosh dataset whose only numeric columns
# were a call id and day/month, so those were all the anomaly engine had to
# report on.
_NON_METRIC_SUFFIXES = ("id", "code")
_NON_METRIC_EXACT = frozenset({"day", "month", "year", "fy"})


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
    distribution: Distribution | None = None
    pii_hints: list[PiiHint] = Field(default_factory=list)
    top_values: list[dict] = Field(
        default_factory=list, description="Top value/value_count pairs"
    )
    sample_values: list[str] = Field(default_factory=list, max_length=5)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_numeric(self) -> bool:
        return self.dtype.startswith(("Int", "Float"))

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_metric(self) -> bool:
        """Numeric and a measurement, not an identifier or a calendar part.

        Every engine that scores numeric columns filters on this, so the rule
        lives here once rather than being restated in each of them.
        """
        if not self.is_numeric:
            return False
        low = self.name.lower()
        return low not in _NON_METRIC_EXACT and not low.endswith(_NON_METRIC_SUFFIXES)


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
    profile_version: str = "0.1.1"