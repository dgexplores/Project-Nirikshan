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