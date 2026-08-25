import pytest
from bdd_forensics.false_consensus import detect_false_consensus


def _claim(cid: str, artifact: str, derived: str | None = None, value: float = 100.0):
    return {
        "claim_id": cid,
        "metric": "total_beneficiaries",
        "value": value,
        "artifact_id": artifact,
        "derived_from": derived,
    }


def test_two_distinct_origins_corroborate() -> None:
    result = detect_false_consensus(
        [
            _claim("c1", "art-a"),
            _claim("c2", "art-b"),
        ]
    )
    assert result is not None
    assert result.verdict == "independent_corroboration"
    assert result.diversity_ratio == 1.0
    assert result.severity == "info"


def test_derived_claim_shares_origin() -> None:
    result = detect_false_consensus(
        [
            _claim("c1", "art-a"),
            _claim("c2", "art-b", derived="art-a"),
        ]
    )
    assert result is not None
    assert result.verdict == "shared_origin_suspected"
    assert result.apparent_sources == 2
    assert result.distinct_origins == 1
    assert result.diversity_ratio == 0.5
    groups = {g.origin_artifact_id: g.members for g in result.origin_groups}
    assert set(groups["art-a"]) == {"c1", "c2"}


def test_single_claim_returns_none() -> None:
    assert detect_false_consensus([_claim("c1", "art-a")]) is None


def test_empty_returns_none() -> None:
    assert detect_false_consensus([]) is None


def test_many_copies_escalates_severity() -> None:
    claims = [_claim(f"c{i}", f"art-{i}", derived="origin-1") for i in range(5)]
    result = detect_false_consensus(claims)
    assert result is not None
    assert result.verdict == "shared_origin_suspected"
    assert result.severity == "high"


@pytest.mark.parametrize(
    "claims",
    [
        [],
        [_claim("only", "a")],
    ],
)
def test_no_comparison_cases(claims) -> None:
    assert detect_false_consensus(claims) is None
