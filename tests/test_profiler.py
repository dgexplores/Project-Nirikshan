import polars as pl
import pytest
from bdd_forensics.profiler import profile_dataset


def _df() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "district": ["Bareilly", "Bareilly", "Meerut", None, "Meerut", "Meerut"],
            "year": [2021, 2021, 2022, 2022, 2023, 2023],
            "beneficiaries": [100, 100, 200, 300, 5_000_000, 250],
        }
    )


def test_profile_counts() -> None:
    p = profile_dataset(dataset_id="ds-1", artifact_id="art-1", df=_df())
    assert p.column_count == 3
    assert p.duplicate_rows == 1


def test_column_profile_nulls_and_stats() -> None:
    p = profile_dataset(dataset_id="ds-1", artifact_id="art-1", df=_df())
    district = {c.name: c for c in p.columns}["district"]
    assert district.null_count == 1
    assert district.null_ratio == pytest.approx(1 / 6, abs=1e-3)

    bens = {c.name: c for c in p.columns}["beneficiaries"]
    assert bens.min_value == 100.0
    assert bens.max_value == 5_000_000.0


def test_quality_observations_present() -> None:
    p = profile_dataset(dataset_id="ds-1", artifact_id="art-1", df=_df())
    codes = {o.code for o in p.quality_observations}
    assert "DUPLICATE_ROWS" in codes
    assert "COLUMN_HIGH_NULL_RATIO" not in codes  # 1/6 = 17%
    assert "COLUMN_ALL_NULL" not in codes


def test_all_null_column_flagged() -> None:
    df = pl.DataFrame({"a": [1, 2], "b": [None, None]})
    p = profile_dataset(dataset_id="ds-9", artifact_id="art-9", df=df)
    assert any(o.code == "COLUMN_ALL_NULL" for o in p.quality_observations)


def test_constant_column_flagged() -> None:
    df = pl.DataFrame({"a": [7, 7, 7]})
    p = profile_dataset(dataset_id="ds-10", artifact_id="art-10", df=df)
    assert any(o.code == "COLUMN_CONSTANT" for o in p.quality_observations)


def test_candidate_key_detected() -> None:
    df = pl.DataFrame({"id": [1, 2, 3, 4], "v": [1, 2, 3, 4]})
    p = profile_dataset(dataset_id="ds-11", artifact_id="art-11", df=df)
    assert ["id"] in p.candidate_keys


def test_numeric_distribution_present() -> None:
    df = pl.DataFrame({"amount": [1, 2, 3, 4, 100]})
    p = profile_dataset(dataset_id="ds-12", artifact_id="art-12", df=df)
    dist = {c.name: c for c in p.columns}["amount"].distribution
    assert dist is not None
    assert dist.p50 == pytest.approx(3.0)
    assert dist.p95 == pytest.approx(100.0)
    assert dist.skewness is not None


def test_pii_hint_by_value_shape() -> None:
    df = pl.DataFrame({"aadhaar": ["2345 6789 0123", "5678 1234 9012", "bad"]})
    p = profile_dataset(dataset_id="ds-13", artifact_id="art-13", df=df)
    hints = {c.name: c for c in p.columns}["aadhaar"].pii_hints
    assert len(hints) == 1
    assert hints[0].hint_type == "aadhaar"
    assert hints[0].matched_values == 2
    assert hints[0].column == "aadhaar"


def test_pii_hint_by_column_name() -> None:
    df = pl.DataFrame({"email": ["a@b.co", "x@y.io"], "v": [1, 2]})
    p = profile_dataset(dataset_id="ds-14", artifact_id="art-14", df=df)
    hints = {c.name: c for c in p.columns}["email"].pii_hints
    assert len(hints) == 1
    assert hints[0].hint_type == "email"


def test_pan_and_mobile_shape_match() -> None:
    df = pl.DataFrame({"pan_no": ["ABCDE1234F", "NOTAPAN"], "phone": ["+91 9876543210", "123"]})
    p = profile_dataset(dataset_id="ds-15", artifact_id="art-15", df=df)
    cols = {c.name: c for c in p.columns}
    assert cols["pan_no"].pii_hints[0].hint_type == "pan"
    assert cols["phone"].pii_hints[0].hint_type == "mobile_phone"


def test_no_pii_on_plain_data() -> None:
    df = pl.DataFrame({"district": ["Bareilly", "Meerut"], "year": [2021, 2022]})
    p = profile_dataset(dataset_id="ds-16", artifact_id="art-16", df=df)
    assert all(not c.pii_hints for c in p.columns)