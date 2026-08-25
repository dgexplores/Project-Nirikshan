"""BDD forensics pipeline: profiling, normalization, rules, comparisons."""

from bdd_forensics.benford import analyze_benford, expected_first_digit_shares
from bdd_forensics.definitions import infer_definition_cards
from bdd_forensics.drift import detect_definition_drift, overall_decision
from bdd_forensics.entity_resolution import (
    geo_gate_fuzzy,
    match_entities,
    normalize_entity,
)
from bdd_forensics.false_consensus import SourceClaim, detect_false_consensus
from bdd_forensics.fitness import compute_fitness
from bdd_forensics.lineage import build_lineage
from bdd_forensics.profiler import profile_dataset

__all__ = [
    "SourceClaim",
    "analyze_benford",
    "build_lineage",
    "compute_fitness",
    "detect_definition_drift",
    "detect_false_consensus",
    "expected_first_digit_shares",
    "geo_gate_fuzzy",
    "infer_definition_cards",
    "match_entities",
    "normalize_entity",
    "overall_decision",
    "profile_dataset",
]
