import io

import polars as pl
from bdd_forensics.fitness import compute_fitness
from bdd_forensics.profiler import profile_dataset


def _profile(csv: str):
    df = pl.read_csv(io.StringIO(csv))
    return profile_dataset(dataset_id="ds-x", artifact_id="art-x", df=df)


def test_clean_dataset_scores_high() -> None:
    profile = _profile(
        "district,value\nA,1\nB,2\nC,3\nD,4\nE,5\nF,6\nG,7\nH,8\nI,9\nJ,10\n"
    )
    fitness = compute_fitness(profile)
    assert fitness.score >= 85
    assert fitness.grade in {"A", "B"}
    names = {c.name for c in fitness.components}
    assert {
        "completeness",
        "duplication",
        "validity",
        "consistency",
        "identifier_exposure",
        "distribution_health",
    } == names
    total_weight = sum(c.weight for c in fitness.components)
    assert abs(total_weight - 1.0) < 1e-9


def test_pii_dataset_penalized_with_detail() -> None:
    profile = _profile(
        "aadhaar,district\n2345-6789-0123,A\n3456-7890-1234,B\n"
    )
    fitness = compute_fitness(profile)
    comp = next(c for c in fitness.components if c.name == "identifier_exposure")
    assert comp.score < 100
    assert "aadhaar" in comp.detail.lower()


def test_nulls_and_duplicates_lower_score() -> None:
    clean = _profile("district,v\nA,1\nB,2\nC,3\nD,4\n")
    messy = _profile("district,v\nA,1\nA,1\n,\n,\n")
    assert compute_fitness(messy).score < compute_fitness(clean).score


def test_deterministic() -> None:
    csv = "district,v\nA,1\nB,2\nC,3\nD,4\nE,5\n"
    first = compute_fitness(_profile(csv))
    second = compute_fitness(_profile(csv))
    assert first.score == second.score
    assert first.grade == second.grade
    assert [c.model_dump() for c in first.components] == [c.model_dump() for c in second.components]


def test_distribution_health_ignores_identifier_and_calendar_columns() -> None:
    """An id or a calendar part is numeric, but it is not a measurement.

    `month` is constant here, so it counts as zero-variance and used to pull
    the data-quality score down over a column that has no expected shape.
    """
    csv = "district,call_id,month,amount\n" + "\n".join(
        f"D{i},{1000 + i},6,{10 + i}" for i in range(10)
    ) + "\n"
    profile = _profile(csv)
    assert {c.name for c in profile.columns if c.is_metric} == {"amount"}

    health = next(c for c in compute_fitness(profile).components if c.name == "distribution_health")
    assert health.score == 100.0, health.detail
