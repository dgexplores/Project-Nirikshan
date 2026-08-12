import pytest
from bdd_contracts.semantic import DefinitionCard
from bdd_forensics.drift import detect_definition_drift, overall_decision


def _card(**overrides: object) -> DefinitionCard:
    base: dict = {
        "card_id": "dc-1",
        "concept_id": "beneficiary_count",
        "operational_definition": "paid beneficiaries",
        "scope": "India",
        "denominator": "population",
        "unit": "count",
    }
    base.update(overrides)
    return DefinitionCard(**base)


def test_identical_cards_no_drift() -> None:
    assert detect_definition_drift(before=_card(), after=_card(card_id="dc-2")) == []
    assert overall_decision([]) == "comparable"


def test_denominator_change_blocks() -> None:
    findings = detect_definition_drift(
        before=_card(), after=_card(card_id="dc-2", denominator="households")
    )
    assert len(findings) == 1
    f = findings[0]
    assert f.drift_type == "denominator"
    assert f.comparability_decision == "not_comparable"
    assert f.severity == "high"
    assert f.semantic_impact == pytest.approx(0.9)
    assert overall_decision(findings) == "not_comparable"


def test_unit_scale_change_is_partial() -> None:
    findings = detect_definition_drift(
        before=_card(), after=_card(card_id="dc-2", unit="lakh")
    )
    assert len(findings) == 1
    assert findings[0].drift_type == "unit"
    assert findings[0].comparability_decision == "partial"
    assert "normalize" in findings[0].evidence[0].lower()
    assert findings[0].severity == "medium"


def test_unit_alias_is_not_drift() -> None:
    assert detect_definition_drift(
        before=_card(unit="lakh"), after=_card(card_id="dc-2", unit="lac")
    ) == []


def test_unit_base_change_blocks() -> None:
    findings = detect_definition_drift(
        before=_card(unit="count"),
        after=_card(card_id="dc-2", unit="crore rs"),
    )
    assert len(findings) == 1
    assert findings[0].drift_type == "unit"
    assert findings[0].comparability_decision == "not_comparable"
    assert "base changed" in findings[0].evidence[0]


def test_unit_metadata_added_is_partial() -> None:
    findings = detect_definition_drift(
        before=_card(unit=None), after=_card(card_id="dc-2", unit="count")
    )
    assert len(findings) == 1
    assert findings[0].drift_type == "unit"
    assert findings[0].comparability_decision == "partial"


def test_definition_reword_is_partial() -> None:
    findings = detect_definition_drift(
        before=_card(operational_definition="paid beneficiaries"),
        after=_card(card_id="dc-2", operational_definition="beneficiaries paid"),
    )
    assert len(findings) == 1
    assert findings[0].drift_type == "definition"
    assert findings[0].comparability_decision == "partial"
    assert findings[0].severity == "low"


def test_definition_change_blocks() -> None:
    findings = detect_definition_drift(
        before=_card(operational_definition="approved applicants"),
        after=_card(card_id="dc-2", operational_definition="paid beneficiaries"),
    )
    assert len(findings) == 1
    assert findings[0].drift_type == "definition"
    assert findings[0].comparability_decision == "not_comparable"
    assert findings[0].severity == "high"


def test_scope_change_is_partial() -> None:
    findings = detect_definition_drift(
        before=_card(scope="India"),
        after=_card(card_id="dc-2", scope="Uttar Pradesh"),
    )
    assert len(findings) == 1
    assert findings[0].drift_type == "scope"
    assert findings[0].comparability_decision == "partial"


def test_multiple_drifts_all_reported() -> None:
    findings = detect_definition_drift(
        before=_card(denominator="population", unit="count", scope="India"),
        after=_card(
            card_id="dc-2",
            denominator="households",
            unit="lakh",
            scope="Uttar Pradesh",
        ),
    )
    assert {f.drift_type for f in findings} == {"denominator", "unit", "scope"}
    assert overall_decision(findings) == "not_comparable"


def test_release_notes_attached() -> None:
    findings = detect_definition_drift(
        before=_card(),
        after=_card(card_id="dc-2", denominator="households"),
        release_notes="coverage definition updated",
    )
    assert any("release notes" in e for e in findings[0].evidence)


def test_finding_ids_deterministic() -> None:
    a = detect_definition_drift(
        before=_card(), after=_card(card_id="dc-2", denominator="households")
    )
    b = detect_definition_drift(
        before=_card(), after=_card(card_id="dc-2", denominator="households")
    )
    assert a[0].finding_id == b[0].finding_id
    assert a[0].finding_id.startswith("drift-dc-1-dc-2-")


def test_impact_never_exceeds_one() -> None:
    before = _card(operational_definition="a b c d e")
    after = _card(card_id="dc-2", operational_definition="f g h i j")
    findings = detect_definition_drift(before=before, after=after)
    assert findings
    for f in findings:
        assert 0.0 <= (f.semantic_impact or 0.0) <= 1.0
