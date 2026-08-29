"""Cross-source contradiction engine (spec 10.4, engine 8).

Runs the comparability gates first; only a 'comparable' pair may be
reconciled numerically. Output stays within the claim taxonomy:
'conflict', 'explainable' or 'not_comparable' - never 'wrong'.
"""

from __future__ import annotations

from bdd_contracts.anomaly import ContradictionFinding

from bdd_forensics.comparability import build_comparability

SourceClaim = dict


def _thresholds() -> dict:
    return {"relative": 0.01, "absolute": 0.01}


def reconcile_claims(
    *,
    claim_a: SourceClaim,
    claim_b: SourceClaim,
    report: dict,
) -> str:
    """Decide reconciliation state from a comparability report and two claims.

    Args:
        claim_a: {source_id, value, ...}.
        claim_b: {source_id, value, ...}.
        report: Output of build_comparability.

    Returns:
        One of 'not_comparable', 'explainable', 'conflict'.
    """
    if report is None or report["overall"]["state"] != "comparable":
        return "not_comparable"
    va = float(claim_a["value"])
    vb = float(claim_b["value"])
    t = _thresholds()
    relative = appr(va, vb, t["relative"])
    if relative:
        return "explainable"
    return "conflict"


def appr(a: float, b: float, rel: float = 0.01) -> bool:
    """Approx equal within a relative tolerance around the larger value."""
    if a == 0 and b == 0:
        return True
    scale = max(abs(a), abs(b))
    return abs(a - b) <= rel * scale


def investigate(
    *,
    finding_id: str,
    claim_a: SourceClaim,
    claim_b: SourceClaim,
    left_df,
    right_df,
    left_district_col: str,
    right_district_col: str,
    left_fy: str | None = None,
    right_fy: str | None = None,
    left_unit: str | None = None,
    right_unit: str | None = None,
    left_definition: str | None = None,
    right_definition: str | None = None,
) -> ContradictionFinding:
    """Full investigation: gate, then reconcile, then produce a finding."""
    report = build_comparability(
        left_df=left_df, right_df=right_df,
        left_district_col=left_district_col, right_district_col=right_district_col,
        left_fy=left_fy, right_fy=right_fy,
        left_unit=left_unit, right_unit=right_unit,
        left_definition=left_definition, right_definition=right_definition,
    )
    state = reconcile_claims(claim_a=claim_a, claim_b=claim_b, report=report)
    explanations: list[str] = []
    if state == "explainable":
        explanations.append("values agree within tolerance after comparability gates")
    elif state == "not_comparable":
        explanations.append(
            "pair fails a comparability gate; do not compare directly"
        )
    else:
        explanations.append("same definition, unit and period; delta not explained")

    va, vb = float(claim_a["value"]), float(claim_b["value"])

    return ContradictionFinding(
        finding_id=finding_id,
        claim_a=claim_a,
        claim_b=claim_b,
        reconciliation_status=state,
        delta=_delta(va, vb, state),
        alignment_tests=_alignment_summary(report),
        possible_explanations=explanations,
        evidence=[
            f"{claim_a.get('source_id')}@{claim_a.get('locator', '*')}",
            f"{claim_b.get('source_id')}@{claim_b.get('locator', '*')}",
        ],
        severity="medium" if state == "conflict" else "info",
        confidence="high",
    )


def _alignment_summary(report: dict | None) -> dict:
    if report is None:
        return {}
    return {
        name: entry["state"] for name, entry in report.items() if name != "overall"
    }


def _delta(va: float, vb: float, state: str) -> float | None:
    scale = max(abs(va), abs(vb))
    if state == "conflict" and scale != 0:
        return round((vb - va) / scale, 4)
    if state == "explainable":
        return round(abs(vb - va), 4)
    return None


__all__ = ["appr", "investigate", "reconcile_claims"]