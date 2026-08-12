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