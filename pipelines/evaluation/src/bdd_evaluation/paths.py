"""Governed filesystem boundaries for the restricted benchmark store.

These paths live ONLY in this package. The API/service layer has no import
path to them (verified by tests/test_leakage.py) - the application cannot
reach benchmark data even by accident.
"""

from __future__ import annotations

import os
from pathlib import Path

DEFAULT_BENCHMARK_DIR = Path("data/benchmark-restricted")
DEFAULT_EVALUATION_DIR = Path("data/evaluation")


def benchmark_dir() -> Path:
    override = os.environ.get("BDD_BENCHMARK_REGISTRY_PATH")
    if override:
        return Path(override).parent
    return Path(os.environ.get("BDD_BENCHMARK_DIR", str(DEFAULT_BENCHMARK_DIR)))


def registry_path() -> Path:
    override = os.environ.get("BDD_BENCHMARK_REGISTRY_PATH")
    if override:
        return Path(override)
    return benchmark_dir() / "case_registry.csv"


def access_log_path() -> Path:
    return benchmark_dir() / "access.log"


def adjudication_ledger_path() -> Path:
    return benchmark_dir() / "adjudications.csv"


def evaluation_dir() -> Path:
    path = Path(os.environ.get("BDD_EVALUATION_DIR", str(DEFAULT_EVALUATION_DIR)))
    path.mkdir(parents=True, exist_ok=True)
    return path
