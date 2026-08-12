import polars as pl
from bdd_forensics.comparability import build_comparability, compare_units


def _districts(*names: str) -> pl.DataFrame:
    return pl.DataFrame({"district": list(names)})


def test_full_comparability() -> None:
    left = _districts("Bareilly", "Meerut", "Lucknow")
    right = _districts("Bareilly", "Meerut", "Lucknow")
    report = build_comparability(
        left_df=left, right_df=right,
        left_district_col="district", right_district_col="district",
        left_fy="2024-25", right_fy="2024-25",
        left_unit="count", right_unit="count",
        left_definition="paid beneficiaries", right_definition="paid beneficiaries",
    )
    assert report is not None
    assert report["overall"]["state"] == "comparable"


def test_definition_mismatch_blocks() -> None:
    left = _districts("Bareilly", "Meerut")
    right = _districts("Bareilly", "Meerut")
    report = build_comparability(
        left_df=left, right_df=right,
        left_district_col="district", right_district_col="district",
        left_fy="2024-25", right_fy="2024-25",
        left_definition="approved applicants", right_definition="paid beneficiaries",
    )
    assert report["definition"]["state"] == "not_comparable"
    assert report["overall"]["state"] == "not_comparable"


def test_partial_geo_overlap() -> None:
    left = _districts("Bareilly", "Meerut", "Lucknow")
    right = _districts("Bareilly", "Meerut")
    report = build_comparability(
        left_df=left, right_df=right,
        left_district_col="district", right_district_col="district",
    )
    assert report["geography"]["state"] == "partial"
    assert report["overall"]["state"] == "partial"


def test_no_shared_districts_blocks() -> None:
    left = _districts("Bareilly", "Meerut")
    right = _districts("Pune", "Nagpur")
    report = build_comparability(
        left_df=left, right_df=right,
        left_district_col="district", right_district_col="district",
    )
    assert report["geography"]["state"] == "not_comparable"


def test_fiscal_year_mismatch_blocks() -> None:
    left = _districts("Bareilly")
    right = _districts("Bareilly")
    report = build_comparability(
        left_df=left, right_df=right,
        left_district_col="district", right_district_col="district",
        left_fy="2023-24", right_fy="2024-25",
    )
    assert report["temporal"]["state"] == "not_comparable"


def test_unit_scale_partial() -> None:
    state, reason = compare_units("count", "count", left_scale=1.0, right_scale=100_000.0)
    assert state == "partial"
    assert "scale" in reason


def test_empty_pair_none() -> None:
    report = build_comparability(
        left_df=pl.DataFrame({"a": []}),
        right_df=_districts("Bareilly"),
        left_district_col="a",
        right_district_col="district",
    )
    assert report is None