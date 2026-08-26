"""Adjudication + metric reporting (protocol steps 6-7).

Adjudication is deliberately human-in-the-loop: the tool reveals labels for
one case (logged), accepts a decision with matched finding ids, and appends
to an append-only ledger. It never auto-classifies against label text.

Reporting computes metrics ONLY where a denominator exists and refuses to
invent precision/recall without pre-registered matching criteria.
"""

from __future__ import annotations

import csv
from datetime import UTC, datetime
from typing import Any

from bdd_evaluation.blind import load_run
from bdd_evaluation.paths import adjudication_ledger_path
from bdd_evaluation.registry import reveal_case

DECISIONS = ("detected", "partially_detected", "not_detected", "not_detectable")
LEDGER_HEADER = [
    "run_id", "benchmark_case_id", "decision", "matched_finding_ids",
    "note", "adjudicated_at", "adjudicator",
]


def adjudicate(
    run_id: str,
    case_id: str,
    decision: str,
    matched_finding_ids: list[str] | None = None,
    note: str = "",
    adjudicator: str = "cli",
) -> dict[str, Any]:
    """Record one human decision. Verifies run + case + findings exist."""
    if decision not in DECISIONS:
        raise ValueError(f"decision must be one of {DECISIONS}")

    run = load_run(run_id)
    case_entry = next((c for c in run["cases"] if c["case_id"] == case_id), None)
    if case_entry is None:
        raise KeyError(f"case {case_id} not part of run {run_id}")

    known_ids = {f["id"] for f in case_entry["findings"]}
    unknown = set(matched_finding_ids or []) - known_ids
    if unknown:
        raise ValueError(f"matched findings not present in blind run: {sorted(unknown)}")
    if decision in {"detected", "partially_detected"} and not matched_finding_ids:
        raise ValueError("detected/partially_detected require --findings (pre-registered matching)")

    reveal_case(case_id)  # logs the label access

    ledger = adjudication_ledger_path()
    is_new = not ledger.exists()
    with ledger.open("a", newline="") as handle:
        writer = csv.writer(handle)
        if is_new:
            writer.writerow(LEDGER_HEADER)
        writer.writerow([
            run_id, case_id, decision,
            ";".join(sorted(set(matched_finding_ids or []))),
            note, datetime.now(UTC).isoformat(), adjudicator,
        ])
    return {"case": case_id, "decision": decision, "ledger": str(ledger)}


def load_decisions(run_id: str | None = None) -> list[dict[str, str]]:
    ledger = adjudication_ledger_path()
    if not ledger.exists():
        return []
    rows: list[dict[str, str]] = []
    with ledger.open(newline="") as handle:
        for row in csv.DictReader(handle):
            if run_id is None or row.get("run_id") == run_id:
                rows.append(dict(row))
    return rows


def report(run_id: str) -> dict[str, Any]:
    """Metrics with explicit denominators; refuses undefined ones."""
    run = load_run(run_id)
    decisions = {d["benchmark_case_id"]: d for d in load_decisions(run_id)}

    cases = run["cases"]
    mapped_cases = [c for c in cases if c["coverage"] == "mapped"]
    adjudicated = [c for c in cases if c["case_id"] in decisions]

    counts = {d: 0 for d in DECISIONS}
    for c in adjudicated:
        counts[decisions[c["case_id"]]["decision"]] += 1

    total_findings = sum(c["findings_total"] for c in cases)
    complete_findings = sum(c["evidence_complete_findings"] for c in cases)

    detected = counts["detected"]
    partially = counts["partially_detected"]

    out: dict[str, Any] = {
        "run_id": run_id,
        "input_hash": run["input_hash"],
        "cases_total": len(cases),
        "cases_mapped_to_public_artifacts": len(mapped_cases),
        "coverage_ratio": round(len(mapped_cases) / len(cases), 4) if cases else None,
        "cases_adjudicated": len(adjudicated),
        "decisions": counts,
        # detectability rate: denominator = adjudicated cases only
        "detectability_rate": round((detected + partially) / len(adjudicated), 4) if adjudicated else None,
        "evidence_completeness": round(complete_findings / total_findings, 4) if total_findings else None,
        "unmapped_cases": [c["case_id"] for c in cases if c["coverage"] == "unmapped_access_gap"],
        "pending_adjudication": [c["case_id"] for c in cases if c["case_id"] not in decisions],
    }
    if not adjudicated:
        out["note"] = "no adjudications yet - detectability_rate intentionally null"
    return out
