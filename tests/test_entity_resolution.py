from bdd_forensics.entity_resolution import (
    geo_gate_fuzzy,
    match_entities,
    normalize_entity,
)


def test_normalize_strips_admin_suffixes_and_case() -> None:
    assert normalize_entity("Adabari T.E.") == "adabari"
    assert normalize_entity("Chhota Udaipur District") == "chhota udaipur"
    # pure qualifier names degrade to their raw normalized text
    assert normalize_entity("  NORTH   block ") == "north block"
    assert normalize_entity("North Block") == "north block"


def test_match_links_spelling_variants() -> None:
    left = ["Adabari", "Bareilly", "Chhota Udaipur"]
    right = ["Adabari T.E.", "Bareilly ", "Chhotaudepur"]
    matches = match_entities(left, right)
    assert matches["Adabari"] == "Adabari T.E."
    assert matches["Bareilly"] == "Bareilly "
    assert matches["Chhota Udaipur"] == "Chhotaudepur"


def test_match_returns_none_for_unrelated() -> None:
    matches = match_entities(["Bareilly"], ["Kochi"])
    assert matches["Bareilly"] is None


def test_geo_gate_full_overlap_after_fuzzy_resolution() -> None:
    state, reason = geo_gate_fuzzy(
        ["Adabari T.E.", "Bareilly"],
        ["Adabari", "Bareilly"],
    )
    assert state == "comparable"
    assert "2 matched geo entities" in reason


def test_geo_gate_partial_with_gaps() -> None:
    state, reason = geo_gate_fuzzy(
        ["Bareilly", "Meerut", "Gorakhpur"],
        ["Bareilly", "Kanpur"],
    )
    assert state == "partial"
    assert "left-only 2" in reason or "right-only 1" in reason


def test_geo_gate_disjoint_blocks_comparison() -> None:
    state, _reason = geo_gate_fuzzy(["Bareilly"], ["Kochi"])
    assert state == "not_comparable"


def test_geo_gate_empty_side_unknown() -> None:
    assert geo_gate_fuzzy([], ["Bareilly"])[0] == "unknown"
