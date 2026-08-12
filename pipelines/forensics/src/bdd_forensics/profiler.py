"""Deterministic dataset profiler. Pure Python/statistics - no LLM."""

from __future__ import annotations

import re

import polars as pl
from bdd_contracts.profile import (
    PII_TYPE,
    ColumnProfile,
    DatasetProfile,
    Distribution,
    PiiHint,
    QualityObservation,
)

PROFILE_VERSION = "0.1.1"

# Value-shape patterns. Aadhaar requires 4-4-4 grouping so a bare run of
# digits reads as a bank account, not an Aadhaar.
_VALUE_PATTERNS: dict[str, re.Pattern[str]] = {
    "aadhaar": re.compile(r"^[2-9]\d{3}[ -]\d{4}[ -]\d{4}$"),
    "pan": re.compile(r"^[A-Z]{5}\d{4}[A-Z]$"),
    "mobile_phone": re.compile(r"^(?:\+91[ -]?)?[6-9]\d{9}$"),
    "email": re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
    "bank_account": re.compile(r"^\d{9,18}$"),
    "passport": re.compile(r"^[A-Z]\d{7}$"),
    "voter_id": re.compile(r"^[A-Z]{3}\d{7}$"),
}

# Column-name signals. Keyed to a PiiHint type; value regex only used as a
# confirmation when the name alone is ambiguous.
_NAME_SIGNALS: dict[str, tuple[PII_TYPE, re.Pattern[str] | None]] = {
    "aadhaar": ("aadhaar", None),
    "aadhar": ("aadhaar", None),
    "uid": ("aadhaar", None),
    "pan": ("pan", None),
    "pan_no": ("pan", None),
    "pan_number": ("pan", None),
    "mobile": ("mobile_phone", None),
    "phone": ("mobile_phone", None),
    "phone_no": ("mobile_phone", None),
    "mobile_no": ("mobile_phone", None),
    "email": ("email", None),
    "e_mail": ("email", None),
    "mail": ("email", None),
    "account_no": ("bank_account", None),
    "bank_account": ("bank_account", None),
    "bank_ac": ("bank_account", None),
    "passport": ("passport", None),
    "epic": ("voter_id", None),
    "voter": ("voter_id", None),
}


def _top_values(series: pl.Series, limit: int = 5) -> list[dict]:
    counts = (
        series.drop_nulls().value_counts(sort=True, name="value_count").head(limit)
    )
    return [
        {"value": str(row[0]), "count": int(row[1])}
        for row in counts.iter_rows()
    ]


def _sample_values(series: pl.Series, limit: int = 5) -> list[str]:
    return [str(v) for v in series.drop_nulls().unique().head(limit).to_list()]


def _distribution(numeric: pl.Series) -> Distribution | None:
    if len(numeric) == 0:
        return None
    quantiles = numeric.quantile([0.05, 0.25, 0.50, 0.75, 0.95])
    return Distribution(
        p5=float(quantiles[0]) if quantiles is not None else None,
        p25=float(quantiles[1]) if quantiles is not None else None,
        p50=float(quantiles[2]) if quantiles is not None else None,
        p75=float(quantiles[3]) if quantiles is not None else None,
        p95=float(quantiles[4]) if quantiles is not None else None,
        skewness=float(numeric.skew()) if len(numeric) > 1 else None,
    )


def _pii_hints(name: str, series: pl.Series) -> list[PiiHint]:
    lower = name.strip().lower().replace(" ", "_")
    hints: list[PiiHint] = []

    hint_type, confirm = _NAME_SIGNALS.get(lower, (None, None))
    non_null = series.drop_nulls()
    if hint_type is None or non_null.is_empty():
        return hints
    if confirm is not None:
        matches = [v for v in non_null.to_list() if confirm.match(str(v))]
        if not matches:
            return hints
        return [
            PiiHint(
                hint_type=hint_type,
                column=name,
                matched_values=len(matches),
                sample_matches=list(dict.fromkeys(map(str, matches)))[:3],
            )
        ]

    # Name signals for identifier-like fields (aadhaar, pan, ...) count all
    # non-null values as candidate columns pending value-shape confirmation.
    pattern = _VALUE_PATTERNS.get(hint_type)
    if pattern is not None:
        matches = [v for v in non_null.to_list() if pattern.match(str(v))]
        if matches:
            return [
                PiiHint(
                    hint_type=hint_type,
                    column=name,
                    matched_values=len(matches),
                    sample_matches=list(dict.fromkeys(map(str, matches)))[:3],
                )
            ]
    return [
        PiiHint(
            hint_type=hint_type,
            column=name,
            matched_values=len(non_null),
        )
    ]


def _column_profile(name: str, series: pl.Series) -> ColumnProfile:
    non_null = series.drop_nulls()
    null_count = int(series.null_count())
    row_count = max(series.len(), 1)
    numeric = pl.Series([], dtype=pl.Float64)
    if series.dtype.is_numeric():
        numeric = series.cast(pl.Float64, strict=False).drop_nulls()

    return ColumnProfile(
        name=name,
        dtype=str(series.dtype),
        null_count=null_count,
        null_ratio=round(null_count / row_count, 4),
        unique_count=int(non_null.n_unique()),
        min_value=float(numeric.min()) if len(numeric) else None,
        max_value=float(numeric.max()) if len(numeric) else None,
        mean=round(float(numeric.mean()), 4) if len(numeric) else None,
        stddev=round(float(numeric.std()), 4) if len(numeric) > 1 else None,
        distribution=_distribution(numeric),
        pii_hints=_pii_hints(name, series),
        top_values=_top_values(non_null),
        sample_values=_sample_values(non_null),
    )


def _quality_observations(
    df: pl.DataFrame,
    duplicate_rows: int,
    profiles: list[ColumnProfile],
) -> list[QualityObservation]:
    obs: list[QualityObservation] = []

    if duplicate_rows:
        obs.append(
            QualityObservation(
                code="DUPLICATE_ROWS",
                severity="medium" if duplicate_rows > 0.01 * df.height else "low",
                description=f"{duplicate_rows} fully duplicate rows found",
                evidence={"duplicate_rows": duplicate_rows, "row_count": df.height},
            )
        )

    for profile in profiles:
        if profile.null_ratio == 1.0:
            obs.append(
                QualityObservation(
                    code="COLUMN_ALL_NULL",
                    severity="high",
                    column=profile.name,
                    description=f"column {profile.name} is entirely null",
                )
            )
        elif profile.null_ratio > 0.5:
            obs.append(
                QualityObservation(
                    code="COLUMN_HIGH_NULL_RATIO",
                    severity="medium",
                    column=profile.name,
                    description=f"column {profile.name} is {profile.null_ratio:.0%} null",
                    evidence={"null_ratio": profile.null_ratio},
                )
            )
        if profile.unique_count == 1 and profile.null_count == 0:
            obs.append(
                QualityObservation(
                    code="COLUMN_CONSTANT",
                    severity="low",
                    column=profile.name,
                    description=f"column {profile.name} has a single constant value",
                )
            )
        if (
            profile.min_value is not None
            and profile.max_value is not None
            and isinstance(profile.min_value, float)
            and profile.max_value > 0
            and profile.min_value == 0
        ):
            obs.append(
                QualityObservation(
                    code="ZERO_MIN_NUMERIC",
                    severity="info",
                    column=profile.name,
                    description=f"column {profile.name} contains zero values",
                )
            )

    return obs


def _candidate_keys(df: pl.DataFrame) -> list[list[str]]:
    """Single-column candidate keys from unique counts."""
    keys: list[list[str]] = []
    for name in df.columns:
        unique = df[name].n_unique()
        if unique == df.height and unique > 1:
            keys.append([name])
    return keys[:10]


def profile_dataset(*, dataset_id: str, artifact_id: str, df: pl.DataFrame) -> DatasetProfile:
    """Profile a parsed dataframe deterministically."""
    profiles = [
        _column_profile(name, df[name]) for name in df.columns
    ]
    duplicate_rows = int(df.height - df.unique().height)
    observations = _quality_observations(df, duplicate_rows, profiles)
    return DatasetProfile(
        dataset_id=dataset_id,
        artifact_id=artifact_id,
        row_count=df.height,
        column_count=df.width,
        columns=profiles,
        duplicate_rows=duplicate_rows,
        quality_observations=observations,
        candidate_keys=_candidate_keys(df),
        profile_version=PROFILE_VERSION,
    )