import polars as pl
from bdd_forensics.anomaly import detect_iqr, detect_yoy, detect_zscore
from bdd_forensics.cross_source import investigate


def test_zscore_flags_clear_outlier() -> None:
    normal = [100, 102, 99, 101, 98, 103, 100, 101, 99, 102,
              101, 100, 98, 103, 100, 102, 99, 101, 100, 102,
              99, 101, 102, 100, 98, 101, 100, 99, 103, 100]
    df = pl.DataFrame(
        {"district": [str(i) for i in range(len(normal) + 1)],
         "ben": [*normal, 5000]}
    )
    findings = detect_zscore(metric="ben", df=df, value_col="ben", key_col="district")
    assert len(findings) == 1
    f = findings[0]
    assert f.slice == {"district": "30"}
    assert f.observed == 5000.0
    assert f.method == "zscore"
    assert f.evidence_query != ""


def test_zscore_requires_three_rows() -> None:
    df = pl.DataFrame({"district": ["A", "B"], "ben": [10, 999]})
    assert detect_zscore(metric="ben", df=df, value_col="ben") == []


def test_iqr_catches_extreme_tail() -> None:
    df = pl.DataFrame(
        {"district": list("ABCDE"), "amt": [10, 12, 11, 13, 999]}
    )
    findings = detect_iqr(metric="amt", df=df, value_col="amt", key_col="district")
    assert len(findings) == 1
    assert findings[0].slice == {"district": "E"}
    assert findings[0].severity in {"medium", "high"}


def test_yoy_detects_jump_grouped_by_entity() -> None:
    df = pl.DataFrame(
        {
            "district": ["A"] * 6,
            "year": [2019, 2020, 2021, 2022, 2023, 2024],
            "ben": [10, 12, 11, 13, 14, 400],
        }
    )
    findings = detect_yoy(
        metric="ben", df=df, value_col="ben",
        period_col="year", entity_col="district",
    )
    assert len(findings) == 1
    assert findings[0].slice["district"] == "A"
    assert findings[0].slice["period"] == 2024
    assert findings[0].severity == "high"


def test_yoy_ignores_small_changes() -> None:
    df = pl.DataFrame(
        {"year": [2020, 2021, 2022], "ben": [100, 105, 102]}
    )
    findings = detect_yoy(metric="ben", df=df, value_col="ben", period_col="year")
    assert findings == []


def test_investigate_conflict() -> None:
    df_a = pl.DataFrame({"district": ["Bareilly", "Meerut"], "ben": [100, 200]})
    df_b = pl.DataFrame({"district": ["Bareilly", "Meerut"], "ben": [50, 100]})
    f = investigate(
        finding_id="cross-1",
        claim_a={"source_id": "A", "value": 100, "locator": "r1"},
        claim_b={"source_id": "B", "value": 50, "locator": "r1"},
        left_df=df_a, right_df=df_b,
        left_district_col="district", right_district_col="district",
        left_fy="2024-25", right_fy="2024-25",
        left_definition="paid", right_definition="paid",
    )
    assert f.reconciliation_status == "conflict"
    assert f.delta is not None
    assert f.severity == "medium"


def test_investigate_explainable_within_tolerance() -> None:
    df_a = pl.DataFrame({"district": ["Bareilly"], "ben": [100]})
    df_b = pl.DataFrame({"district": ["Bareilly"], "ben": [100.5]})
    f = investigate(
        finding_id="cross-2",
        claim_a={"source_id": "A", "value": 100},
        claim_b={"source_id": "B", "value": 100.5},
        left_df=df_a, right_df=df_b,
        left_district_col="district", right_district_col="district",
    )
    assert f.reconciliation_status == "explainable"


def test_investigate_not_comparable_when_definition_differs() -> None:
    df_a = pl.DataFrame({"district": ["Bareilly"], "ben": [100]})
    df_b = pl.DataFrame({"district": ["Bareilly"], "ben": [50]})
    f = investigate(
        finding_id="cross-3",
        claim_a={"source_id": "A", "value": 100},
        claim_b={"source_id": "B", "value": 50},
        left_df=df_a, right_df=df_b,
        left_district_col="district", right_district_col="district",
        left_definition="approved applicants",
        right_definition="paid beneficiaries",
    )
    assert f.reconciliation_status == "not_comparable"
    assert f.delta is None
    assert f.alignment_tests["definition"] == "not_comparable"


def test_appr_tolerance() -> None:
    from bdd_forensics.cross_source import appr

    assert appr(100, 100.5) is True
    assert appr(100, 150) is False
    assert appr(0, 0) is True