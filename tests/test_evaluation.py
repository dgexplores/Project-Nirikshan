"""Blind benchmark runner tests against a synthetic restricted-style registry."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest
from bdd_cli.main import main

CASES = [
    {
        "benchmark_case_id": "BDD-T1",
        "audit_report_title": "Hidden synthetic audit title alpha",
        "observation_summary": "Hidden label text mentioning INR 999 crore discrepancy in payments",
        "linked_source_ids": "SRC-SYNTH-MICRO-1920",
    },
    {
        "benchmark_case_id": "BDD-T2",
        "audit_report_title": "Hidden audit two",
        "observation_summary": "Another hidden observation about nonexistent portal data",
        "linked_source_ids": "SRC-DOES-NOT-EXIST",
    },
]


@pytest.fixture()
def bench(tmp_path, monkeypatch):
    """Isolated settings + a tiny restricted-style registry + seeded corpus."""
    monkeypatch.setenv("BDD_DATABASE_URL", f"sqlite:///{tmp_path / 'eval.db'}")
    monkeypatch.setenv("BDD_RAW_STORE", str(tmp_path / "raw"))
    monkeypatch.setenv("BDD_MANIFEST_DIR", str(tmp_path / "manifests"))
    monkeypatch.setenv("BDD_FIXTURES_DIR", str(tmp_path / "fixtures"))
    registry = tmp_path / "registry" / "case_registry.csv"
    registry.parent.mkdir(parents=True)
    with registry.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(CASES[0].keys()))
        writer.writeheader()
        writer.writerows(CASES)
    monkeypatch.setenv("BDD_BENCHMARK_REGISTRY_PATH", str(registry))
    monkeypatch.setenv("BDD_EVALUATION_DIR", str(tmp_path / "evaluation"))

    from bdd_api import config

    config.get_settings.cache_clear()
    from bdd_api import db

    db._engine = None
    assert main(["seed"]) == 0
    yield {"registry": registry, "tmp": tmp_path}
    config.get_settings.cache_clear()


def _read_run(bench: dict, out: str) -> dict:
    path = Path(out.split("written to ")[1].strip().splitlines()[0])
    return json.loads(path.read_text())


def test_blind_run_excludes_labels_and_documents_gaps(bench, capsys) -> None:
    assert main(["eval", "run"]) == 0
    out = capsys.readouterr().out
    run = _read_run(bench, out)

    blob = json.dumps(run)
    assert "Hidden" not in blob
    assert "999 crore" not in blob
    assert run["blind_protocol"]["labels_excluded"]

    by_id = {c["case_id"]: c for c in run["cases"]}
    # T1 maps to the seeded micro-irrigation release -> findings visible
    assert by_id["BDD-T1"]["coverage"] == "mapped"
    assert by_id["BDD-T1"]["findings_total"] >= 1
    # T2's source has no public artifact -> documented access gap, valid outcome
    assert by_id["BDD-T2"]["coverage"] == "unmapped_access_gap"


def test_adjudicate_requires_findings_for_detected(bench, capsys) -> None:
    capsys.readouterr()
    assert main(["eval", "run"]) == 0
    run_line = capsys.readouterr().out.strip().splitlines()[0]
    run_id = run_line.split(" ")[2]

    rc = main(["eval", "adjudicate", run_id, "BDD-T1", "--decision", "detected"])
    assert rc == 1  # detected without matched findings refused
    capsys.readouterr()  # clear buffers
    assert main(["eval", "adjudicate", run_id, "BDD-T1", "--decision", "not_detectable", "--note", "no artifact"]) == 0
    capsys.readouterr()

    ledger = bench["tmp"] / ".." / "registry" / "adjudications.csv"
    ledger = Path(__import__("os").environ["BDD_BENCHMARK_REGISTRY_PATH"]).parent / "adjudications.csv"
    rows = list(csv.DictReader(ledger.open()))
    assert len(rows) == 1
    assert rows[0]["decision"] == "not_detectable"

    access_log = Path(__import__("os").environ["BDD_BENCHMARK_REGISTRY_PATH"]).parent / "access.log"
    log_text = access_log.read_text()
    assert "reveal_labels" in log_text and "BDD-T1" in log_text


def test_adjudicate_rejects_unknown_finding_ids(bench, capsys) -> None:
    capsys.readouterr()
    assert main(["eval", "run"]) == 0
    run_id = capsys.readouterr().out.strip().splitlines()[0].split(" ")[2]

    rc = main([
        "eval", "adjudicate", run_id, "BDD-T1",
        "--decision", "partially_detected",
        "--findings", "finding-not-in-run-123",
    ])
    assert rc == 1


def test_report_math_with_denominators(bench, capsys) -> None:
    capsys.readouterr()
    assert main(["eval", "run"]) == 0
    run_id = capsys.readouterr().out.strip().splitlines()[0].split(" ")[2]
    capsys.readouterr()

    # fetch a real finding id from the run for the detected case
    from bdd_evaluation.blind import load_run

    run = load_run(run_id)
    t1 = next(c for c in run["cases"] if c["case_id"] == "BDD-T1")
    fid = t1["findings"][0]["id"]

    assert main(["eval", "adjudicate", run_id, "BDD-T1", "--decision", "detected", "--findings", fid]) == 0
    capsys.readouterr()
    assert main(["eval", "adjudicate", run_id, "BDD-T2", "--decision", "not_detectable"]) == 0
    capsys.readouterr()

    assert main(["eval", "report", run_id, "--json"]) == 0
    metrics = json.loads(capsys.readouterr().out)
    assert metrics["cases_total"] == 2
    assert metrics["cases_mapped_to_public_artifacts"] == 1
    assert metrics["coverage_ratio"] == 0.5
    assert metrics["decisions"]["detected"] == 1
    assert metrics["decisions"]["not_detectable"] == 1
    assert metrics["detectability_rate"] == 0.5  # denominator: adjudicated only


def test_report_before_any_adjudication_is_null_not_zero(bench, capsys) -> None:
    capsys.readouterr()
    assert main(["eval", "run"]) == 0
    run_id = capsys.readouterr().out.strip().splitlines()[0].split(" ")[2]
    capsys.readouterr()

    assert main(["eval", "report", run_id, "--json"]) == 0
    metrics = json.loads(capsys.readouterr().out)
    assert metrics["detectability_rate"] is None
    assert "intentionally null" in metrics["note"]
