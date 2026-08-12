"""Deterministic dataset profiler. Pure Python/statistics - no LLM."""

from __future__ import annotations

import polars as pl
from bdd_contracts.profile import ColumnProfile, DatasetProfile, QualityObservation

PROFILE_VERSION = "0.1.0"


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