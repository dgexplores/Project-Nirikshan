import polars as pl
import pytest
from bdd_forensics.cross_source import investigate


def test_delta_sign_with_negative_claim_value() -> None:
    # _delta used to normalize by max(va, vb) (the signed max), not
    # max(abs(va), abs(vb)). With va=5, vb=-100 that divided by 5 instead
    # of 100 and produced a delta far outside a sane percentage range.
    df_a = pl.DataFrame({"district": ["Bareilly"], "ben": [5]})
    df_b = pl.DataFrame({"district": ["Bareilly"], "ben": [-100]})
    f = investigate(
        finding_id="cross-neg",
        claim_a={"source_id": "A", "value": 5},
        claim_b={"source_id": "B", "value": -100},
        left_df=df_a, right_df=df_b,
        left_district_col="district", right_district_col="district",
    )
    assert f.reconciliation_status == "conflict"
    assert f.delta == pytest.approx(-1.05, abs=1e-4)
