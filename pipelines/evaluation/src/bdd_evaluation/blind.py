"""Blind benchmark run (protocol step 5).

For every registered case the runner sees ONLY a BlindCaseView (case id +
linked source ids). It maps sources to ingested public artifacts via
artifact.source_id, collects every stored finding touching those artifacts,
and freezes an immutable blind-run file whose id is derived from the input
hashes. Labels never enter this stage; a structural guard asserts the output
contains no label text.

A case with zero mapped public artifacts is recorded as a coverage gap -
per protocol, documenting an access/observability limitation is a valid
outcome, not a failure.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from bdd_api.db import ArtifactRow, FindingRow, db_session
from sqlalchemy import select

from bdd_evaluation.paths import evaluation_dir
from bdd_evaluation.registry import load_cases

RUN_VERSION = "0.1.0"


def _collect_public_state() -> tuple[dict[str, dict], list[dict], str]:
    with db_session() as session:
        artifacts = list(session.scalars(select(ArtifactRow)).all())
        findings = list(session.scalars(select(FindingRow)).all())

    art_by_source: dict[str, list[dict]] = {}
    input_hashes: list[str] = []
    for row in artifacts:
        entry = {
            "artifact_id": row.artifact_id,
            "source_id": row.source_id,
            "sha256": row.sha256,
        }
        art_by_source.setdefault(row.source_id, []).append(entry)
        input_hashes.append(row.sha256)

    findings_view = [
        {
            "id": f.finding_id,
            "kind": f.kind,
            "severity": f.severity,
            "confidence": f.confidence,
            "status": f.status,
            "title": f.title,
            "summary": f.summary[:300],
            "artifact_ids": list(map(str, f.artifact_ids or [])),
            "payload": f.payload_json,
        }
        for f in findings
    ]
    return art_by_source, findings_view, hashlib.sha256("|".join(sorted(input_hashes)).encode()).hexdigest()[:16]


def _has_repro(payload: dict) -> bool:
    return bool(payload.get("evidence_query")) or bool(payload.get("evidence_spans")) or bool(payload.get("evidence"))


def run_blind() -> dict[str, Any]:
    """Execute one blinded evaluation pass and persist it under data/evaluation/."""
    cases = load_cases()
    art_by_source, findings_view, input_hash = _collect_public_state()

    case_results: list[dict[str, Any]] = []
    for view in cases:
        mapped: list[dict] = []
        for source_id in view.linked_source_ids:
            mapped.extend(art_by_source.get(source_id, []))
        mapped_ids = {a["artifact_id"] for a in mapped}

        linked_findings = [f for f in findings_view if mapped_ids & set(f["artifact_ids"])]
        complete = sum(1 for f in linked_findings if _has_repro(f["payload"]))

        case_results.append(
            {
                "case_id": view.benchmark_case_id,
                "linked_sources": view.linked_source_ids,
                "mapped_artifacts": sorted(mapped_ids),
                "coverage": "mapped" if mapped else "unmapped_access_gap",
                "findings": [
                    {
                        "id": f["id"],
                        "kind": f["kind"],
                        "severity": f["severity"],
                        "confidence": f["confidence"],
                        "status": f["status"],
                        "title": f["title"],
                        "summary": f["summary"],
                    }
                    for f in linked_findings
                ],
                "findings_total": len(linked_findings),
                "evidence_complete_findings": complete,
            }
        )

    run = {
        "run_version": RUN_VERSION,
        "run_id": f"blind-{input_hash}",
        "created_at": datetime.now(UTC).isoformat(),
        "input_hash": input_hash,
        "blind_protocol": {
            "investigator_saw": ["case_id", "linked_source_ids", "public artifacts", "stored findings"],
            "labels_excluded": ["audit_report_title", "observation_summary", "affected counts"],
        },
        "cases": case_results,
    }

    # Structural leakage guard before writing: label fields must not appear.
    blob = json.dumps(run)
    for case in cases:
        for label_value in (case.audit_report_title, case.observation_summary):
            distinctive = label_value[:40]
            if len(distinctive) >= 12 and distinctive in blob:
                raise RuntimeError(
                    f"leakage guard tripped: label text from {case.benchmark_case_id} present in blind output"
                )

    out_path = evaluation_dir() / f"{run['run_id']}.json"
    out_path.write_text(json.dumps(run, indent=2, default=str) + "\n")
    return {"run_id": run["run_id"], "path": str(out_path), "cases": len(case_results), "input_hash": input_hash}


def load_run(run_id: str) -> dict[str, Any]:
    path = evaluation_dir() / f"{run_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"no such blind run: {path}")
    return json.loads(path.read_text())
