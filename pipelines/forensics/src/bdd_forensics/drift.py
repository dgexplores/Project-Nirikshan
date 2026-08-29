"""Semantic drift detector (spec 10.1, engine 11). Deterministic, no LLM.

Compares two DefinitionCard versions of the same concept and emits one
DriftFinding per changed semantic dimension: denominator, unit, definition
and scope. The comparability decision and severity follow the *semantic
impact* of each change, not the size of the string diff: a reworded
definition that keeps the same meaning scores far lower than a denominator
or unit base change.

Findings never overwrite source facts; callers keep the raw cards. A
"comparable" outcome means the cards describe the same measure in a way
that can be compared directly - nothing more.
"""

from __future__ import annotations

import re
from typing import NamedTuple

from bdd_contracts.anomaly import DriftFinding
from bdd_contracts.semantic import DefinitionCard

from bdd_forensics.normalize import unit_scale

DRIFT_VERSION = "0.1.0"

# Jaccard token similarity above which a definition text change is treated
# as a rewording (partial) instead of a semantic change (not_comparable).
REWORD_SIMILARITY = 0.8

# Substrings that mark an INR-denominated unit label. Recognized Indian
# scale words (lakh/crore/thousand) are handled by unit_scale first.
_INR_HINTS = ("inr", "rupee", "rs", "\u20b9")


class _Drift(NamedTuple):
    drift_type: str
    decision: str
    impact: float
    evidence: list[str]


def _norm(text: str | None) -> str:
    return (text or "").strip().lower()


def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", text.lower()) if t}


def token_similarity(a: str, b: str) -> float:
    """Jaccard similarity over word tokens. Order-insensitive and robust
    to punctuation, which a raw string diff is not."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta and not tb:
        return 1.0
    return len(ta & tb) / len(ta | tb)


def _unit_base(name: str | None) -> str | None:
    """Coarse base for a unit label: 'INR', 'count', or None if unknown."""
    if name is None:
        return None
    low = name.strip().lower()
    if any(h in low for h in _INR_HINTS):
        return "INR"
    if unit_scale(low) is not None:
        return "count"
    return None


def _denominator_drift(before: str | None, after: str | None) -> _Drift | None:
    if before is None and after is None:
        return None
    if before is None or after is None:
        return _Drift(
            "denominator",
            "partial",
            0.3,
            [f"denominator metadata added/removed ({before!r} -> {after!r})"],
        )
    if _norm(before) == _norm(after):
        return None
    return _Drift(
        "denominator",
        "not_comparable",
        0.9,
        [f"denominator changed: {before} -> {after}"],
    )


def _unit_drift(before: str | None, after: str | None) -> _Drift | None:
    if before is None and after is None:
        return None
    if before is None or after is None:
        return _Drift(
            "unit",
            "partial",
            0.2,
            [f"unit metadata added/removed ({before!r} -> {after!r})"],
        )
    if _norm(before) == _norm(after):
        return None

    scale_before, scale_after = unit_scale(before), unit_scale(after)
    if scale_before is not None and scale_after is not None:
        if scale_before == scale_after:
            # Alias, e.g. lakh vs lac: same canonical scale, no drift.
            return None
        return _Drift(
            "unit",
            "partial",
            0.55,
            [f"unit scale changed: {before} -> {after}; normalize to a canonical unit before comparing"],
        )

    base_before, base_after = _unit_base(before), _unit_base(after)
    if base_before is not None and base_after is not None and base_before != base_after:
        return _Drift(
            "unit",
            "not_comparable",
            0.9,
            [f"unit base changed: {before} ({base_before}) -> {after} ({base_after})"],
        )
    return _Drift(
        "unit",
        "partial",
        0.5,
        [f"unit label changed: {before} -> {after}; semantic equivalence unverified"],
    )


def _definition_drift(before: str, after: str) -> _Drift | None:
    if _norm(before) == _norm(after):
        return None
    sim = token_similarity(before, after)
    if sim >= REWORD_SIMILARITY:
        return _Drift(
            "definition",
            "partial",
            0.3,
            [f"definition reworded (similarity {sim:.2f}); verify intent is unchanged"],
        )
    return _Drift(
        "definition",
        "not_comparable",
        0.7,
        [f"operational definition appears changed (similarity {sim:.2f})"],
    )


def _scope_drift(before: str | None, after: str | None) -> _Drift | None:
    if before is None and after is None:
        return None
    if before is None or after is None:
        return _Drift(
            "scope",
            "partial",
            0.2,
            [f"scope metadata added/removed ({before!r} -> {after!r})"],
        )
    if _norm(before) == _norm(after):
        return None
    return _Drift(
        "scope",
        "partial",
        0.4,
        [f"coverage changed: {before} -> {after}; compare only on the overlap"],
    )


def _to_finding(before: DefinitionCard, after: DefinitionCard, drift: _Drift) -> DriftFinding:
    decision = drift.decision
    severity = (
        "high"
        if decision == "not_comparable"
        else "medium"
        if drift.impact >= 0.5
        else "low"
    )
    concept = after.concept_id or before.concept_id
    evidence = list(drift.evidence)
    evidence.append(f"cards: {before.card_id} -> {after.card_id}")
    return DriftFinding(
        finding_id=f"drift-{before.card_id}-{after.card_id}-{drift.drift_type}",
        concept_id=concept,
        before_definition=before.operational_definition,
        after_definition=after.operational_definition,
        drift_type=drift.drift_type,
        impact_scope=f"comparisons of {concept} across releases",
        comparability_decision=decision,
        evidence=evidence,
        severity=severity,
        semantic_impact=drift.impact,
    )


def detect_definition_drift(
    *,
    before: DefinitionCard,
    after: DefinitionCard,
    release_notes: str | None = None,
) -> list[DriftFinding]:
    """Emit one DriftFinding per drifted semantic dimension.

    Args:
        before: Earlier DefinitionCard version.
        after: Later DefinitionCard version of the same concept.
        release_notes: Optional human-readable note appended to evidence.

    Returns:
        One finding per drifted dimension (denominator, unit, definition,
        scope). Empty list means the cards are directly comparable.
    """
    checks = [
        _denominator_drift(before.denominator, after.denominator),
        _unit_drift(before.unit, after.unit),
        _definition_drift(before.operational_definition, after.operational_definition),
        _scope_drift(before.scope, after.scope),
    ]
    findings = [_to_finding(before, after, d) for d in checks if d is not None]
    if release_notes and findings:
        for f in findings:
            f.evidence.append(f"release notes: {release_notes}")
    return findings


def overall_decision(findings: list[DriftFinding]) -> str:
    """Worst comparability decision across drifted dimensions.

    'not_comparable' dominates, then 'partial'; an empty list means the
    pair is 'comparable'.
    """
    if not findings:
        return "comparable"
    if any(f.comparability_decision == "not_comparable" for f in findings):
        return "not_comparable"
    if any(f.comparability_decision == "partial" for f in findings):
        return "partial"
    return "comparable"


__all__ = ["DRIFT_VERSION", "REWORD_SIMILARITY", "detect_definition_drift", "overall_decision", "token_similarity"]
