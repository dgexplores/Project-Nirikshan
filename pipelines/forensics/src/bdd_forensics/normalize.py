"""Deterministic unit and fiscal-year normalization. No LLM.

Supports the Indian unit scale (lakh, crore, thousand) and common fiscal
year label forms. All conversions are exact scale factors - the caller
owns the canonical unit chosen.
"""

from __future__ import annotations

import hashlib
import re
from datetime import date

from bdd_contracts.semantic import TemporalResolution, UnitNorm

# Scale factor from "one unit" to a single base value.
_INDIC_UNITS: dict[str, float] = {
    "unit": 1.0,
    "nos": 1.0,
    "number": 1.0,
    "count": 1.0,
    "thousand": 1_000.0,
    "lakh": 100_000.0,
    "lac": 100_000.0,
    "crore": 10_000_000.0,
}

_FY_RE = re.compile(
    r"^(?:FY|F\.Y\.?)?\s*"
    r"(?P<start>\d{4})\s*[-–—/]\s*(?P<end>\d{2,4})"
    r"\s*(?:\(?(?P<style>CA|CE|TE)\)?)?$",
    re.IGNORECASE,
)


def _stable_id(*parts: str) -> str:
    """Deterministic short id from input parts (no runtime hash())."""
    digest = hashlib.sha1("|".join(parts).encode()).hexdigest()
    return digest[:8]


class UnitNormalizationError(ValueError):
    """Raised for an unknown unit or a non-numeric magnitude."""


def normalize_indic_unit(raw_value: float, unit_name: str) -> UnitNorm:
    """Scale a value expressed in Indian units to base count/INR.

    Args:
        raw_value: Numeric magnitude in the source unit.
        unit_name: Unit label, e.g. 'lakh', 'crore', 'thousand'.

    Raises:
        UnitNormalizationError: If the unit name is not recognized.
    """
    scale = _INDIC_UNITS.get(unit_name.strip().lower())
    if scale is None:
        raise UnitNormalizationError(f"unknown unit: {unit_name!r}")
    return UnitNorm(
        raw_value=raw_value,
        raw_unit=unit_name,
        canonical_unit="count",
        multiplier=scale,
        base="count",
    )


def normalize_inr(raw_value: float, unit_name: str) -> UnitNorm:
    """Scale an INR amount to rupees from lakh/crore units."""
    scale = _INDIC_UNITS.get(unit_name.strip().lower())
    if scale is None:
        raise UnitNormalizationError(f"unknown INR unit: {unit_name!r}")
    return UnitNorm(
        raw_value=raw_value,
        raw_unit=unit_name,
        canonical_unit="INR",
        multiplier=scale,
        base="INR",
    )


def parse_fiscal_year(label: str) -> TemporalResolution:
    """Parse common Indian fiscal-year labels into a resolution.

    Examples:
        >>> parse_fiscal_year("FY 2024-25").fiscal_year
        '2024-25'

    Handles 'FY 2024-25', '2024-25', '2024-2025', calendar-only labels
    degrade to no fiscal-year resolution.
    """
    m = _FY_RE.match(label.strip())
    if m is None:
        return TemporalResolution(
            resolution_id=f"tr-fy-{_stable_id(label)}",
            raw_text=label,
            comparability_flags=["not_a_fiscal_year_label"],
        )

    start = int(m.group("start"))
    end_raw = m.group("end")
    end = start + 1 if len(end_raw) == 2 else int(end_raw)
    fy = f"{start}-{str(end)[-2:]}"

    return TemporalResolution(
        resolution_id=f"tr-fy-{start}",
        raw_text=label,
        fiscal_year=fy,
        granularity="fiscal_year",
        event_period=(date(start, 4, 1), date(end, 3, 31)),
        comparability_flags=["fiscal_year"],
    )