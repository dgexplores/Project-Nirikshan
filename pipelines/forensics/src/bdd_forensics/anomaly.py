"""Deterministic statistical anomaly engine. Pure Python/NumPy - no LLM.

Detects z-score outliers, IQR outliers, and year-over-year jumps. Every
finding records its method, score, expected baseline and a reproducible
evidence query. No causal claims are made.
"""

from __future__ import annotations

import polars as pl
from bdd_contracts.anomaly import AnomalyFinding

ZSCORE_THRESHOLD = 3.0
IQR_MULTIPLIER = 1.5
YOY_MAX_RATIO = 3.0


def _zscore(series: pl.Series) -> pl.Series:
    s = series.drop_nulls()
    if len(s) < 3:
        return pl.Series([])
    mean = s.mean()
    std = s.std()
    if std is None or std == 0:
        return pl.Series([])
    return ((s - mean) / std).alias(s.name)


def detect_zscore(
    *, metric: str, df: pl.DataFrame, value_col: str, key_col: str | None = None,
    threshold: float = ZSCORE_THRESHOLD,
) -> list[AnomalyFinding]:
    """Flag rows whose z-score exceeds threshold. Rows are facts, not verdicts."""
    findings: list[AnomalyFinding] = []
    s = _zscore(df[value_col])
    if s.is_empty():
        return findings
    mean = df[value_col].mean()
    for row in df.with_columns(s.alias("_z")).iter_rows(named=True):
        z = row["_z"]
        if z is None or abs(z) <= threshold:
            continue
        slice_, key = _slice_for(row, key_col)
        findings.append(
            AnomalyFinding(
                finding_id=f"an-{len(findings):03d}",
                metric=metric,
                slice=slice_,
                observed=float(row[value_col]),
                expected=_round(mean),
                baseline=_round(mean),
                method="zscore",
                score=round(float(z), 2),
                severity=_severity(abs(z)),
                confidence="high",
                evidence_query=_evq("zscore", value_col, key),
                caveats=["value deviates from cohort distribution"],
            )
        )
    return findings


def detect_iqr(
    *, metric: str, df: pl.DataFrame, value_col: str, key_col: str | None = None,
) -> list[AnomalyFinding]:
    """Flag rows outside fence = Q3 + 1.5*IQR (robust to outliers)."""
    findings: list[AnomalyFinding] = []
    vals = sorted(df[value_col].drop_nulls().to_list())
    if len(vals) < 4:
        return findings
    q1, q3 = _quantile(vals, 0.25), _quantile(vals, 0.75)
    iqr = q3 - q1
    if iqr == 0:
        return findings
    lo, hi = q1 - IQR_MULTIPLIER * iqr, q3 + IQR_MULTIPLIER * iqr
    for row in df.iter_rows(named=True):
        v = row[value_col]
        if v is None or lo <= v <= hi:
            continue
        slice_, key = _slice_for(row, key_col)
        findings.append(
            AnomalyFinding(
                finding_id=f"an-{len(findings):03d}",
                metric=metric,
                slice=slice_,
                observed=float(v),
                expected=_round(q3),
                baseline=_round(q3),
                method="iqr",
                score=_round((v - q3) / iqr) if iqr else None,
                severity=_severity(abs(v - q3) / iqr) if iqr else "medium",
                confidence="high",
                evidence_query=_evq("iqr", value_col, key, bounds=f"{lo},{hi}"),
                caveats=["value outside robust IQR fence"],
            )
        )
    return findings


def detect_yoy(
    *,
    metric: str, df: pl.DataFrame, value_col: str, period_col: str,
    entity_col: str | None = None, max_ratio: float = YOY_MAX_RATIO,
) -> list[AnomalyFinding]:
    """Flag consecutive-period changes with |change| exceeding the ratio.

    Entity column (e.g. district) groups the series; rows must be sorted
    within each group for a meaningful 'previous' comparison.
    """
    findings: list[AnomalyFinding] = []
    df = df.sort([p for p in [entity_col, period_col] if p])

    if entity_col:
        frames = []
        for _, g in df.group_by(entity_col, maintain_order=True):
            frames.append(_yoy_frame(g, value_col, period_col))
        combined = pl.concat(frames)
    else:
        combined = _yoy_frame(df, value_col, period_col)

    for row in combined.iter_rows(named=True):
        pct = row["_pct"]
        if pct is None or abs(pct) <= 100.0 * (max_ratio - 1):
            continue
        slice_, key = _slice_for(row, entity_col)
        slice_["period"] = row[period_col]
        findings.append(
            AnomalyFinding(
                finding_id=f"an-{len(findings):03d}",
                metric=metric,
                slice=slice_,
                observed=float(row[value_col]),
                expected=_round(row["_prev"]) if row["_prev"] is not None else None,
                baseline=_round(row["_prev"]) if row["_prev"] is not None else None,
                method="yoy_change",
                score=_round(pct),
                severity="high" if abs(pct) > 500.0 else "medium",
                confidence="moderate",
                evidence_query=_evq("yoy_change", value_col, key),
                caveats=["may be a definition, boundary or reporting-period change"],
            )
        )
    return findings


def _yoy_frame(g: pl.DataFrame, value_col: str, period_col: str) -> pl.DataFrame:
    g = g.sort(period_col)
    prev = g[value_col].shift(1)
    pct = ((g[value_col] - prev) / prev * 100).alias("_pct")
    return g.with_columns(prev.alias("_prev"), pct)


def _slice_for(row: dict, key_col: str | None) -> tuple[dict, str]:
    if key_col is not None and key_col in row:
        return {key_col: str(row[key_col])}, str(row[key_col])
    return {}, "*"


def _quantile(vals: list[float], q: float) -> float:
    pos = (len(vals) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(vals) - 1)
    frac = pos - lo
    return vals[lo] + (vals[hi] - vals[lo]) * frac


def _severity(z: float) -> str:
    if abs(z) >= 4:
        return "high"
    if abs(z) >= 3:
        return "medium"
    return "low"


def _round(v: float) -> float:
    return round(float(v), 4)


def _evq(method: str, value_col: str, key: str, bounds: str | None = None) -> str:
    base = f"{method} over {value_col}"
    return f"{base} slice={key}" + (f" bounds={bounds}" if bounds else "")


__all__ = ["detect_iqr", "detect_yoy", "detect_zscore"]