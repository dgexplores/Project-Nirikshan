"""Restricted benchmark registry access (governance boundary).

This module is the ONLY place allowed to read the hidden CAG case registry.
Every read appends to the access log. Label fields (audit_report_title,
observation_summary) are exposed solely to the adjudication stage - never to
the blind runner, never to the API, never to retrieval.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from datetime import UTC, datetime

from bdd_evaluation.paths import access_log_path, registry_path


@dataclass(frozen=True)
class BenchmarkCase:
    benchmark_case_id: str
    audit_report_title: str  # LABEL - adjudication only
    observation_summary: str  # LABEL - adjudication only
    linked_source_ids: list[str]


@dataclass(frozen=True)
class BlindCaseView:
    """What the investigator may see: identity + source mapping, no labels."""

    benchmark_case_id: str
    linked_source_ids: list[str]

    @classmethod
    def from_case(cls, case: BenchmarkCase) -> BlindCaseView:
        return cls(benchmark_case_id=case.benchmark_case_id, linked_source_ids=list(case.linked_source_ids))


def _access_log(action: str, detail: dict) -> None:
    entry = {"ts": datetime.now(UTC).isoformat(), "action": action, **detail}
    with access_log_path().open("a") as handle:
        handle.write(json.dumps(entry, default=str) + "\n")


def load_cases() -> list[BenchmarkCase]:
    """Read the restricted registry; logs access. Raises FileNotFoundError if absent."""
    path = registry_path()
    if not path.exists():
        raise FileNotFoundError(
            f"benchmark registry not found at {path} - it is intentionally not committed"
        )
    cases: list[BenchmarkCase] = []
    with path.open(newline="") as handle:
        for row in csv.DictReader(handle):
            cases.append(
                BenchmarkCase(
                    benchmark_case_id=(row.get("benchmark_case_id") or "").strip(),
                    audit_report_title=(row.get("audit_report_title") or "").strip(),
                    observation_summary=(row.get("observation_summary") or "").strip(),
                    linked_source_ids=[
                        s.strip() for s in (row.get("linked_source_ids") or "").split(";") if s.strip()
                    ],
                )
            )
    _access_log("read_registry", {"cases": len(cases)})
    return [c for c in cases if c.benchmark_case_id]


def reveal_case(case_id: str) -> BenchmarkCase:
    """Adjudication-stage label access; logs an explicit reveal event."""
    for case in load_cases():
        if case.benchmark_case_id == case_id:
            _access_log("reveal_labels", {"case": case_id})
            return case
    raise KeyError(f"unknown benchmark case {case_id}")
