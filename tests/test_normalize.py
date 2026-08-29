from datetime import date

import pytest
from bdd_forensics.normalize import (
    UnitNormalizationError,
    normalize_indic_unit,
    normalize_inr,
    parse_fiscal_year,
)


def test_lakh_scale() -> None:
    u = normalize_indic_unit(2.41, "lakh")
    assert u.normalized_value == pytest.approx(241_000.0)


def test_crore_scale() -> None:
    u = normalize_indic_unit(3.5, "crore")
    assert u.normalized_value == pytest.approx(35_000_000.0)


def test_thousand_and_unit() -> None:
    assert normalize_indic_unit(10, "thousand").normalized_value == 10_000.0
    assert normalize_indic_unit(7, "nos").normalized_value == 7.0


def test_inr_lakh_to_rupees() -> None:
    u = normalize_inr(947, "crore")
    assert u.base == "INR"
    assert u.normalized_value == pytest.approx(9_470_000_000.0)


def test_unknown_unit_raises() -> None:
    with pytest.raises(UnitNormalizationError):
        normalize_indic_unit(1.0, "bigha")


def test_fy_label_parses() -> None:
    t = parse_fiscal_year("FY 2024-25")
    assert t.fiscal_year == "2024-25"
    assert t.granularity == "fiscal_year"
    assert t.event_period == (date(2024, 4, 1), date(2025, 3, 31))


def test_fy_full_year_parses() -> None:
    t = parse_fiscal_year("2024-2025")
    assert t.fiscal_year == "2024-25"


def test_non_fy_label_flagged() -> None:
    t = parse_fiscal_year("as on 31/03/2025")
    assert t.fiscal_year is None
    assert "not_a_fiscal_year_label" in t.comparability_flags


def test_fy_stable_ids() -> None:
    a = parse_fiscal_year("some label")
    b = parse_fiscal_year("some label")
    assert a.resolution_id == b.resolution_id


def test_fy_label_inconsistent_end_year_flagged() -> None:
    # An Indian fiscal year always spans exactly one year boundary, so
    # "2024-27" is a data-entry defect, not a valid start+3 fiscal year.
    # The end year still resolves to 2025, but the mismatch must be
    # surfaced rather than the label's typo being silently accepted.
    t = parse_fiscal_year("FY 2024-27")
    assert t.fiscal_year == "2024-25"
    assert t.event_period == (date(2024, 4, 1), date(2025, 3, 31))
    assert "fiscal_year_label_inconsistent" in t.comparability_flags