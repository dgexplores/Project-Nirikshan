"""False Consensus Detection engine (spec engine 10, section 10.3).

Several pages repeating a number are not independent confirmation if they
trace to the same origin. Given claims that each name the artifact they
originated from (plus optionally the upstream origin they were derived
from), this engine groups claims by *distinct origin* and reports evidence
diversity instead of raw source count.

Deterministic: no LLM, no network.
"""

from __future__ import annotations

from typing import TypedDict

from bdd_contracts.consensus import ConsensusFinding, ConsensusVerdict, OriginGroup

CONSENSUS_VERSION = "0.1.0"


class SourceClaim(TypedDict):
    """One reported number and where it came from."""

    claim_id: str
    metric: str
    value: float | str
    artifact_id: str  # the artifact/page the number was read from
    derived_from: str | None  # upstream artifact it was copied/derived from, if known


def _origin_of(claim: SourceClaim) -> str:
    return claim["derived_from"] or claim["artifact_id"]


def detect_false_consensus(claims: list[SourceClaim]) -> ConsensusFinding | None:
    """Score evidence diversity across claims of one metric.

    Returns ``None`` when fewer than two claims exist (nothing to compare).
    """
    if len(claims) < 2:
        return None

    groups: dict[str, list[str]] = {}
    for claim in claims:
        groups.setdefault(_origin_of(claim), []).append(claim["claim_id"])

    apparent_sources = len(claims)
    ordered = sorted(groups.items(), key=lambda kv: kv[0])
    distinct_origins = len(ordered)
    diversity_ratio = distinct_origins / apparent_sources

    if diversity_ratio >= 0.999:
        verdict: ConsensusVerdict = "independent_corroboration"
        severity = "info"
        confidence = "high"
    elif diversity_ratio <= 0.6:
        verdict = "shared_origin_suspected"
        severity = "medium" if apparent_sources <= 3 else "high"
        confidence = "moderate"
    else:
        verdict = "shared_origin_suspected"
        severity = "low"
        confidence = "moderate"

    metric_values = {str(claim["metric"]) for claim in claims}
    metric = metric_values.pop() if len(metric_values) == 1 else "multiple metrics"

    return ConsensusFinding(
        finding_id=f"cons-{_stable_id(sorted(c['claim_id'] for c in claims))}",
        metric=metric,
        apparent_sources=apparent_sources,
        distinct_origins=distinct_origins,
        diversity_ratio=round(diversity_ratio, 4),
        verdict=verdict,
        origin_groups=[OriginGroup(origin_artifact_id=origin, members=members) for origin, members in ordered],
        severity=severity,
        confidence=confidence,
    )


def _stable_id(parts: list[str]) -> str:
    import hashlib

    payload = "|".join(parts).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:12]
