"""BDD forensics pipeline: profiling, normalization, rules, comparisons."""

from bdd_forensics.definitions import infer_definition_cards
from bdd_forensics.drift import detect_definition_drift, overall_decision
from bdd_forensics.false_consensus import SourceClaim, detect_false_consensus
from bdd_forensics.fitness import compute_fitness
from bdd_forensics.lineage import build_lineage
from bdd_forensics.profiler import profile_dataset

__all__ = [
    "SourceClaim",
    "build_lineage",
    "compute_fitness",
    "detect_definition_drift",
    "detect_false_consensus",
    "infer_definition_cards",
    "overall_decision",
    "profile_dataset",
]
