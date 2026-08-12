"""Deterministic dataset-pair comparability (spec FR-03/FR-04, engine 9).

Given two parsed datasets and optional definitions, decide whether their
aggregates can be directly compared. Every check is deterministic and
reproducible; the output is a per-dimension status dict. No LLM involved.
"""

from __future__ import annotations

from typing import Literal

import polars as pl

ComparableState = Literal["comparable", "partial", "not_comparable", "unknown"]


def _unique_values(df: pl.DataFrame, column: str) -> set[str]:
    if column not in df.columns:
        return set()
    return {str(v) for v in df[column].drop_nulls().unique().to_list()}


def compare_districts(
    left: pl.DataFrame, right: pl.DataFrame, left_col: str, right_col: str
) -> tuple[ComparableState, str]:
    """Geo overlap check on the overlap of district name sets.

    Returns (state, reason). 'comparable' means both agree to gate a
    comparison; 'partial' flags visible coverage gaps.
    """
    a = _unique_values(left, left_col)
    b = _unique_values(right, right_col)
    if not a or not b:
        return ("unknown", "one dataset has no district values")
    inter = a & b
    if not inter:
        return ("not_comparable", "no shared districts")
    left_only = a - b
    right_only = b - a
    if left_only or right_only:
        union = a | b
        reason = (
            f"partial geo overlap {len(inter)}/{len(union)} "
            f"(left-only {len(left_only)}, right-only {len(right_only)})"
        )
        return ("partial", reason)
    return ("comparable", f"full overlap ({len(inter)} districts)")


def compare_fiscal_years(
    left_fy: str | None, right_fy: str | None
) -> tuple[ComparableState, str]:
    if left_fy is None and right_fy is None:
        return ("unknown", "no fiscal year metadata")
    if left_fy == right_fy and left_fy is not None:
        return ("comparable", f"same fiscal year {left_fy}")
    if left_fy is None or right_fy is None:
        return ("partial", "one dataset lacks fiscal year")
    return ("not_comparable", f"fiscal years differ: {left_fy} vs {right_fy}")


def compare_units(
    left_unit: str | None, right_unit: str | None, left_scale: float = 1.0, right_scale: float = 1.0
) -> tuple[ComparableState, str]:
    """Unit comparability. Same unit name but different stated scale
    (e.g. raw count vs lakh) is 'partial' until scaled.
    """
    if left_unit is None or right_unit is None:
        return ("unknown", "unit metadata missing")
    if left_unit.lower() == right_unit.lower() and left_scale == right_scale:
        return ("comparable", f"same unit {left_unit}")
    if left_unit.lower() == right_unit.lower():
        return ("partial", f"same unit {left_unit} but scale differs")
    return ("not_comparable", f"units differ: {left_unit} vs {right_unit}")


def compare_definition(
    left_def: str | None, right_def: str | None
) -> tuple[ComparableState, str]:
    if left_def is None or right_def is None:
        return ("unknown", "definition card missing")
    if left_def.lower() == right_def.lower():
        return ("comparable", "same operational definition")
    return ("not_comparable", f"definitions differ: {left_def!r} vs {right_def!r}")


def build_comparability(
    *,
    left_df: pl.DataFrame,
    right_df: pl.DataFrame,
    left_district_col: str,
    right_district_col: str,
    left_fy: str | None = None,
    right_fy: str | None = None,
    left_unit: str | None = None,
    right_unit: str | None = None,
    left_definition: str | None = None,
    right_definition: str | None = None,
) -> dict | None:
    """Run the comparability gates over a dataset pair.

    Returns:
        A report dict keyed by 'geography', 'temporal', 'unit',
        'definition', 'overall'; None if a pair is empty.
    """
    if left_df.is_empty() or right_df.is_empty():
        return None

    geo, geo_reason = compare_districts(
        left_df, right_df, left_district_col, right_district_col
    )
    temporal, temporal_reason = compare_fiscal_years(left_fy, right_fy)
    unit, unit_reason = compare_units(left_unit, right_unit)
    definition, def_reason = compare_definition(left_definition, right_definition)

    overall: ComparableState
    if "not_comparable" in (geo, temporal, unit, definition):
        blockers = [r for s, r in (
            (geo, geo_reason), (temporal, temporal_reason),
            (unit, unit_reason), (definition, def_reason),
        ) if s == "not_comparable"]
        overall = "not_comparable"
        overall_reason = f"blocking: {'; '.join(blockers)}"
    elif "partial" in (geo, temporal, unit, definition):
        overall = "partial"
        overall_reason = "at least one dimension needs pre-scaling or clarification"
    else:
        overall = "comparable"
        overall_reason = "all comparability gates passed"

    return {
        "geography": {"state": geo, "reason": geo_reason},
        "temporal": {"state": temporal, "reason": temporal_reason},
        "unit": {"state": unit, "reason": unit_reason},
        "definition": {"state": definition, "reason": def_reason},
        "overall": {"state": overall, "reason": overall_reason},
    }


__all__ = ["build_comparability", "compare_definition", "compare_districts", "compare_fiscal_years", "compare_units"]