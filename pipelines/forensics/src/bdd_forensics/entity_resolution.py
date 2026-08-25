"""Fuzzy entity resolution for Indian geographic/administrative names.

Real public datasets spell the same place many ways: "Adabari" vs
"Adabari T.E.", "Chhota Udaipur" vs "Chhotaudepur". Exact set overlap then
wrongly reports "no shared districts" and blocks valid comparisons.

This module normalizes names, matches them with RapidFuzz token ratios, and
exposes a geography gate with the same shape as the exact one in
comparability.py so pipelines can swap it in transparently.

Deterministic: fixed scoring, sorted tie-breaks.
"""

from __future__ import annotations

import re

from rapidfuzz import fuzz

ENTITY_RESOLUTION_VERSION = "0.1.0"

DEFAULT_THRESHOLD = 88.0

# Administrative suffixes/qualifiers that carry no identity once stripped
_STRIP_TOKENS = {
    "te", "t.e", "town", "tehsil", "taluk", "taluka", "block", "district",
    "dist", "dt", "village", "gram", "nagar", "new", "old", "east", "west",
    "north", "south", "upper", "lower",
}

_NON_ALNUM = re.compile(r"[^a-z0-9\s]")


def normalize_entity(name: str) -> str:
    """Lowercase, strip punctuation, drop admin suffixes/single letters,
    collapse spaces."""
    lowered = _NON_ALNUM.sub(" ", (name or "").lower())
    tokens = [t for t in lowered.split() if len(t) > 1 and t not in _STRIP_TOKENS]
    if not tokens:
        # everything was a suffix qualifier: fall back to raw normalized text
        tokens = [t for t in lowered.split() if t]
    return " ".join(tokens)


def match_entities(
    left: list[str],
    right: list[str],
    *,
    threshold: float = DEFAULT_THRESHOLD,
) -> dict[str, str | None]:
    """Map each left value to its best right match above ``threshold``.

    Returns {left_value: right_value_or_None}. Best match = max of
    token_set_ratio and ratio on normalized strings; inputs are iterated
    sorted so ties resolve deterministically.
    """
    result: dict[str, str | None] = {}
    prepared_right = [(r, normalize_entity(r)) for r in sorted(set(right))]
    for l in sorted(set(left)):
        nl = normalize_entity(l)
        nl_compact = nl.replace(" ", "")
        best_score = -1.0
        best: str | None = None
        for r, nr in prepared_right:
            score = max(
                fuzz.token_set_ratio(nl, nr),
                fuzz.ratio(nl, nr),
                fuzz.ratio(nl_compact, nr.replace(" ", "")),  # compound names
            )
            if score > best_score:
                best_score = score
                best = r
        result[l] = best if (best is not None and best_score >= threshold) else None
    return result


def geo_gate_fuzzy(
    left_values: list[str],
    right_values: list[str],
    *,
    threshold: float = DEFAULT_THRESHOLD,
    label: str = "geo entities",
) -> tuple[str, str]:
    """Geography comparability gate with fuzzy matching.

    Same contract as comparability.compare_districts:
    returns (state, reason) where state is one of
    comparable / partial / not_comparable / unknown.
    """
    a = {str(v).strip() for v in left_values if str(v).strip()}
    b = {str(v).strip() for v in right_values if str(v).strip()}
    if not a or not b:
        return ("unknown", "one dataset has no geographic values")

    matches = match_entities(sorted(a), sorted(b), threshold=threshold)
    matched_pairs = {(l, r) for l, r in matches.items() if r is not None}
    matched_left = {l for l, _ in matched_pairs}
    matched_right = {r for _, r in matched_pairs}

    if not matched_pairs:
        return ("not_comparable", f"no shared {label} (even after fuzzy matching)")

    left_only = sorted(a - matched_left)
    right_only = sorted(b - matched_right)

    examples: list[str] = []
    for l, r in sorted(matched_pairs)[:3]:
        if l != r:
            examples.append(f"{l} ~ {r}")

    reason_parts = [f"{len(matched_pairs)} matched {label}"]
    if examples:
        reason_parts.append("variants resolved: " + "; ".join(examples))
    if left_only or right_only:
        reason_parts.append(f"gaps: left-only {len(left_only)}, right-only {len(right_only)}")

    if not left_only and not right_only:
        state = "comparable"
    else:
        state = "partial"

    return (state, "; ".join(reason_parts))
