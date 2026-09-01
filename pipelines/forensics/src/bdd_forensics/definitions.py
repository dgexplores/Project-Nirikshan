"""Derive DefinitionCards from a dataset profile (spec engines 3/4 bridge).

Uploaded CSVs do not ship semantic metadata. To make drift detection work on
plain releases, this module infers a conservative definition card per numeric
column from its name:

- unit suffix in the column name wins (``amount_inr_lakh`` -> INR/lakh)
- ``per_<x>`` / ``per_<x>_<y>`` marks a denominator (rate columns)
- otherwise the unit is ``count`` with no denominator

Inferred cards are always marked ``inference`` so the UI can show they were
derived, not asserted by a publisher.
"""

from __future__ import annotations

import re

from bdd_contracts.profile import DatasetProfile
from bdd_contracts.semantic import DefinitionCard

_UNIT_SUFFIXES: dict[str, tuple[str, float]] = {
    "crore": ("INR crore", 1e7),
    "lakh": ("INR lakh", 1e5),
    "lac": ("INR lakh", 1e5),
    "thousand": ("thousand", 1e3),
    "inr": ("INR", 1.0),
    "rs": ("INR", 1.0),
    "percent": ("percent", 1.0),
    "pct": ("percent", 1.0),
    "count": ("count", 1.0),
}

_DENOM_RE = re.compile(r"_per_([a-z_]+)$")
_SUFFIX_RE = re.compile(r"_({})$".format("|".join(_UNIT_SUFFIXES)))
_AMBIGUITY_TOKENS = ("approx", "estimated", "unaudited", "provisional")


def _base_name(column: str) -> tuple[str, str, float]:
    """Split a column into (base, unit_suffix_label, multiplier)."""
    base = column.strip().lower()
    m = _DENOM_RE.search(base)
    denom = m.group(1) if m else None
    if denom:
        base = base[: m.start()]
    m = _SUFFIX_RE.search(base)
    if m:
        unit_label = m.group(1)
        multiplier = _UNIT_SUFFIXES[unit_label][1]
        base = base[: m.start()]
    else:
        unit_label = "count"
        multiplier = 1.0
    return base.rstrip("_") or column.strip().lower(), unit_label, multiplier


def infer_definition_cards(profile: DatasetProfile) -> list[DefinitionCard]:
    """Infer one definition card per measured numeric column of a profile."""
    cards: list[DefinitionCard] = []
    seen: set[str] = set()
    for col in profile.columns:
        if not col.is_metric:
            continue
        _, unit_label, _ = _base_name(col.name)
        card_key = f"{profile.artifact_id}:{col.name}"
        if card_key in seen:
            continue
        seen.add(card_key)

        denominator = None
        scope_parts: list[str] = [f"column '{col.name}'"]
        m = _DENOM_RE.search(col.name.lower())
        if m:
            denominator = m.group(1).replace("_", " ")

        flags: list[str] = []
        lowered = col.name.lower()
        for token in _AMBIGUITY_TOKENS:
            if token in lowered:
                flags.append(f"name_contains_{token}")
        if col.null_ratio > 0.5:
            flags.append("majority_null")

        cards.append(
            DefinitionCard(
                card_id=f"dc:{card_key}",
                concept_id=_concept_id(col.name),
                operational_definition=(
                    f"{col.name} as reported in this artifact; inferred unit '{unit_label}'"
                    + (f"; rate per {denominator}" if denominator else "")
                ),
                scope="; ".join(scope_parts),
                denominator=denominator,
                unit=unit_label,
                evidence_spans=[f"{profile.artifact_id}#column={col.name}"],
                ambiguity_flags=flags,
                approval_status="proposed",
            )
        )
    return cards


def _concept_id(column: str) -> str:
    """Stable concept identity: base name with unit suffix stripped, so the
    same measure reported in different units still pairs up for drift checks."""
    base, _, _ = _base_name(column)
    return base
