"""Unit tests for the deterministic answer synthesis + safety gate."""

from __future__ import annotations

from bdd_api.ask import _BANNED_PATTERN, EvidenceCard, _deterministic_answer, _safety_gate, _tokens


def _cards() -> list[EvidenceCard]:
    return [
        EvidenceCard(ref="E1", artifact_id="art-a", locator="art-a#column=v", snippet="column 'v' (Int64), 0% nulls"),
        EvidenceCard(ref="E2", artifact_id="art-b", locator="finding:f-1", snippet="v outlier zscore"),
    ]


def test_tokenizer_drops_stopwords_and_short_tokens() -> None:
    tokens = _tokens("What is the total of beneficiaries in FY 2024?")
    assert "the" not in tokens
    assert "is" not in tokens
    assert "beneficiaries" in tokens
    assert "fy" not in tokens
    assert "2024" in tokens


def test_tokenizer_bridges_hindi_domain_words_to_english() -> None:
    # Pure Devanagari used to tokenize to nothing at all (regex was ASCII
    # only), so a genuine Hindi question always fell through to a refusal
    # regardless of what evidence actually existed.
    tokens = _tokens("बरेली में कितने लाभार्थी हैं")
    assert "beneficiaries" in tokens
    assert "बरेली" in tokens


def test_deterministic_answer_cites_every_card() -> None:
    answer = _deterministic_answer("tell me about v", _cards(), {})
    for card in _cards():
        assert f"[{card.ref}]" in answer
    assert "not verdicts" in answer.lower()


def test_banned_pattern_catches_accusations() -> None:
    for phrase in ("this is fraud", "officials are corrupt", "data is fake", "they cheated"):
        assert _BANNED_PATTERN.search(phrase), phrase
    for safe in ("possible inconsistency flagged for review", "values differ across releases"):
        assert not _BANNED_PATTERN.search(safe)


def test_safety_gate_rejects_uncited_llm_answer() -> None:
    answer, mode = _safety_gate("The total is 42.", _cards(), "llm")
    assert answer == ""
    assert mode == "deterministic"


def test_safety_gate_accepts_cited_llm_answer() -> None:
    answer = "Column v exists in the artifact [E1] and an outlier was flagged [E2]."
    final, mode = _safety_gate(answer, _cards(), "llm")
    assert mode == "llm"
    assert "[E1]" in final


def test_safety_gate_rewrites_accusatory_llm_answer() -> None:
    answer = "The data shows fraud [E1]."
    _final, mode = _safety_gate(answer, _cards(), "llm")
    assert mode == "deterministic"


def test_safety_gate_redacts_deterministic_slip() -> None:
    answer = "Possible fraud detected [E1]"
    final, mode = _safety_gate(answer, _cards(), "deterministic")
    assert mode == "deterministic"
    assert "fraud" not in final.lower()
    assert "[redacted judgment word]" in final
