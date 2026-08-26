"""Blind benchmark runner (restricted). Never loaded at app runtime; the API
package holds no imports of this module (enforced by tests/test_leakage.py).
"""

from bdd_evaluation.adjudicate import DECISIONS, adjudicate, load_decisions, report
from bdd_evaluation.blind import load_run, run_blind
from bdd_evaluation.registry import BenchmarkCase, BlindCaseView, load_cases, reveal_case

__all__ = [
    "DECISIONS",
    "BenchmarkCase",
    "BlindCaseView",
    "adjudicate",
    "load_cases",
    "load_decisions",
    "load_run",
    "report",
    "reveal_case",
    "run_blind",
]
