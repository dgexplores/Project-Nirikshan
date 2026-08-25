"""Data Fitness Score engine (spec engine 14).

Deterministic scoring of a dataset profile on five weighted components:
completeness, duplication, validity (high-severity observations),
consistency (medium/low observations) and identifier exposure (PII hints).
The score describes fitness for forensic comparison; it never asserts the
underlying facts are correct.
"""

from __future__ import annotations

from bdd_contracts.fitness import FitnessComponent, FitnessGrade, FitnessScore
from bdd_contracts.profile import DatasetProfile

FITNESS_VERSION = "0.1.0"

_WEIGHTS = {
    "completeness": 0.30,
    "duplication": 0.15,
    "validity": 0.20,
    "consistency": 0.15,
    "identifier_exposure": 0.10,
    "distribution_health": 0.10,
}


def _grade(score: float) -> FitnessGrade:
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    return "F"


def _completeness(profile: DatasetProfile) -> FitnessComponent:
    if not profile.columns:
        return FitnessComponent(name="completeness", score=0.0, weight=_WEIGHTS["completeness"], detail="no columns profiled")
    avg_null = sum(c.null_ratio for c in profile.columns) / len(profile.columns)
    score = max(0.0, 100.0 * (1.0 - avg_null))
    worst = max(profile.columns, key=lambda c: c.null_ratio)
    detail = f"avg null ratio {avg_null:.1%}; worst column '{worst.name}' at {worst.null_ratio:.1%}"
    return FitnessComponent(name="completeness", score=round(score, 2), weight=_WEIGHTS["completeness"], detail=detail)


def _duplication(profile: DatasetProfile) -> FitnessComponent:
    total = max(profile.row_count, 1)
    ratio = profile.duplicate_rows / total
    score = max(0.0, 100.0 * (1.0 - min(ratio * 5, 1.0)))
    return FitnessComponent(
        name="duplication",
        score=round(score, 2),
        weight=_WEIGHTS["duplication"],
        detail=f"{profile.duplicate_rows} duplicate rows of {profile.row_count}",
    )


def _observations_penalty(profile: DatasetProfile, severities: set[str]) -> tuple[float, int]:
    hits = [o for o in profile.quality_observations if o.severity in severities]
    penalty = {"high": 30.0, "medium": 12.0, "low": 4.0, "info": 0.0}
    deducted = sum(penalty.get(o.severity, 4.0) for o in hits)
    return max(0.0, 100.0 - deducted), len(hits)


def _validity(profile: DatasetProfile) -> FitnessComponent:
    score, n = _observations_penalty(profile, {"high"})
    codes = sorted({o.code for o in profile.quality_observations if o.severity == "high"})
    detail = f"{n} high-severity observation(s)" + (f": {', '.join(codes)}" if codes else "")
    return FitnessComponent(name="validity", score=round(score, 2), weight=_WEIGHTS["validity"], detail=detail)


def _consistency(profile: DatasetProfile) -> FitnessComponent:
    score, n = _observations_penalty(profile, {"medium", "low"})
    return FitnessComponent(
        name="consistency", score=round(score, 2), weight=_WEIGHTS["consistency"], detail=f"{n} medium/low-severity observation(s)"
    )


def _identifier_exposure(profile: DatasetProfile) -> FitnessComponent:
    pii_columns = sorted({h.column for col in profile.columns for h in col.pii_hints})
    if not pii_columns:
        return FitnessComponent(
            name="identifier_exposure", score=100.0, weight=_WEIGHTS["identifier_exposure"], detail="no identifier-shaped columns detected"
        )
    score = max(40.0, 100.0 - 15.0 * len(pii_columns))
    return FitnessComponent(
        name="identifier_exposure",
        score=round(score, 2),
        weight=_WEIGHTS["identifier_exposure"],
        detail=f"PII/identifier hints in {len(pii_columns)} column(s): {', '.join(pii_columns)} - review before sharing",
    )


def _distribution_health(profile: DatasetProfile) -> FitnessComponent:
    numeric = [c for c in profile.columns if c.dtype.startswith(("Int", "Float"))]
    if not numeric:
        return FitnessComponent(name="distribution_health", score=80.0, weight=_WEIGHTS["distribution_health"], detail="no numeric columns to assess")
    degenerate = 0
    skewed = 0
    for col in numeric:
        if col.stddev is not None and col.stddev == 0:
            degenerate += 1
        elif col.distribution is not None and col.distribution.skewness is not None and abs(col.distribution.skewness) > 5:
            skewed += 1
    flagged = degenerate + skewed
    score = max(0.0, 100.0 - 20.0 * flagged / len(numeric))
    parts = []
    if degenerate:
        parts.append(f"{degenerate} zero-variance")
    if skewed:
        parts.append(f"{skewed} heavily skewed")
    detail = "; ".join(parts) if parts else f"distributions within expected shape across {len(numeric)} numeric column(s)"
    return FitnessComponent(name="distribution_health", score=round(score, 2), weight=_WEIGHTS["distribution_health"], detail=detail)


def compute_fitness(profile: DatasetProfile) -> FitnessScore:
    """Compute the deterministic composite fitness score for a profile."""
    components = [
        _completeness(profile),
        _duplication(profile),
        _validity(profile),
        _consistency(profile),
        _identifier_exposure(profile),
        _distribution_health(profile),
    ]
    total_weight = sum(c.weight for c in components)
    score = sum(c.score * c.weight for c in components) / total_weight
    return FitnessScore(
        artifact_id=profile.artifact_id,
        score=round(score, 2),
        grade=_grade(score),
        components=components,
    )
