from bdd_contracts.semantic import (
    DefinitionCard,
    GeoResolution,
    SchemaMapping,
    TemporalResolution,
    UnitNorm,
)


def test_schema_mapping_full() -> None:
    m = SchemaMapping(
        mapping_id="sm-1",
        artifact_id="art-1",
        raw_field="dist_nm",
        canonical_field="district_name",
        transform="strip_whitespace",
        confidence=0.99,
        evidence=["metadata section 2"],
        approval_status="proposed",
    )
    assert m.canonical_field == "district_name"
    assert m.approval_status == "proposed"


def test_definition_card_with_denominator() -> None:
    d = DefinitionCard(
        card_id="dc-1",
        concept_id="beneficiary_count",
        operational_definition="Approved applicant count",
        scope="UP",
        denominator="population",
        unit="count",
        evidence_spans=["doc.pdf p.4"],
        ambiguity_flags=["approved_vs_paid"],
    )
    assert d.denominator == "population"
    assert d.ambiguity_flags == ["approved_vs_paid"]


def test_geo_resolution_preferred_match() -> None:
    g = GeoResolution(
        resolution_id="gr-1",
        raw_value="BE",
        canonical_code="IN-UP",
        canonical_name="Uttar Pradesh",
        level="state",
        match_method="alias",
        confidence=0.8,
        alternatives=["Bihar"],
    )
    assert g.level == "state"
    assert g.confidence == 0.8


def test_unit_norm_lakh_to_count() -> None:
    u = UnitNorm(
        raw_value=2.41,
        raw_unit="lakh",
        canonical_unit="count",
        multiplier=100_000.0,
        base="count",
    )
    assert u.normalized_value == 241_000.0


def test_temporal_resolution_calendar_only() -> None:
    t = TemporalResolution(
        resolution_id="tr-1",
        raw_text="2024",
        comparability_flags=["not_a_fiscal_year_label"],
    )
    assert t.fiscal_year is None
    assert "not_a_fiscal_year_label" in t.comparability_flags

def test_no_definition_card_for_identifier_or_calendar_columns() -> None:
    """A definition card guesses a unit and a denominator for a measurement.

    Emitting one for a call id, a year or an fy invents meaning for a label.
    """
    import io

    import polars as pl
    from bdd_forensics.definitions import infer_definition_cards
    from bdd_forensics.profiler import profile_dataset

    df = pl.read_csv(io.StringIO("call_id,year,fy,amount_inr\n1001,2023,2023,50\n1002,2024,2024,60\n"))
    profile = profile_dataset(dataset_id="ds-c", artifact_id="art-c", df=df)

    # concept_id is the base name, so "amount_inr" becomes "amount".
    assert {c.concept_id for c in infer_definition_cards(profile)} == {"amount"}


def test_year_and_fy_are_labels_not_metrics() -> None:
    """Guards a rule that would otherwise be silent.

    `year` and `fy` were added to the non-metric set alongside `day`/`month`.
    They are period labels: a year column has no distribution to violate, and
    scoring it produced findings about the calendar rather than the data.
    """
    from bdd_contracts.profile import ColumnProfile

    def col(name: str) -> ColumnProfile:
        return ColumnProfile(name=name, dtype="Int64", null_count=0, null_ratio=0.0, unique_count=4)

    for label in ("year", "fy", "day", "month", "call_id", "district_code"):
        assert not col(label).is_metric, label
    for metric in ("amount_inr", "paid_amount", "persondays"):
        assert col(metric).is_metric, metric
