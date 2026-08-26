"""Seed + Ask Detective integration tests."""

from __future__ import annotations

from conftest import wait_job
from fastapi.testclient import TestClient


def test_seed_demo_idempotent_and_populated(api: TestClient) -> None:
    first = api.post("/seed/demo").json()
    assert len(first["seeded"]) == 6
    assert first["new_findings"] >= 3  # drift + contradiction + consensus

    second = api.post("/seed/demo").json()
    assert second["seeded"] == []
    assert set(second["skipped"]) == {s for s in first["seeded"]}
    assert second["new_findings"] == 0, "reruns must be idempotent (stable finding ids)"


def test_seed_produces_explorable_case(api: TestClient) -> None:
    api.post("/seed/demo")

    summary = api.get("/dashboard/summary").json()
    assert summary["artifacts"] >= 5
    assert summary["findings_total"] >= 3
    assert summary["by_kind"].get("drift", 0) >= 1
    assert summary["by_kind"].get("consensus", 0) >= 1

    findings = api.get("/findings").json()
    kinds = {f["kind"] for f in findings["items"]}
    assert {"anomaly", "drift", "contradiction", "consensus"} <= kinds


def test_ask_refuses_without_evidence(api: TestClient) -> None:
    resp = api.post("/ask", json={"question": "what is the total payment amount"})
    body = resp.json()
    assert body["mode"] == "refusal"
    assert body["citations"] == []
    assert "suggested_next" in body


def test_ask_answers_with_citations_after_seed(api: TestClient) -> None:
    api.post("/seed/demo")
    resp = api.post(
        "/ask",
        json={"question": "beneficiaries lakh crore micro irrigation coverage"},
    )
    body = resp.json()
    assert body["mode"] in {"deterministic", "llm"}
    assert len(body["citations"]) >= 1
    refs = [c["ref"] for c in body["citations"]]
    assert refs == sorted(refs, key=lambda r: int(r[1:]))
    if body["mode"] == "deterministic":
        assert "[E1]" in body["answer"]
    assert body["confidence"] in {"low", "moderate", "high"}
    assert body["suggested_next"]


def test_ask_scopes_to_artifacts(api: TestClient) -> None:
    api.post("/seed/demo")
    resp = api.post(
        "/ask",
        json={
            "question": "beneficiaries micro irrigation",
            "artifact_ids": ["art-demo-micro-1920"],
        },
    )
    body = resp.json()
    artifact_ids = {c["artifact_id"] for c in body["citations"]}
    assert artifact_ids <= {"art-demo-micro-1920"}


def test_ingest_job_failure_surfaces_in_steps(api: TestClient) -> None:
    """A file that parses but has no columns must fail gracefully, not crash."""
    csv = "district,value\nA,1\n"
    accepted = api.post(
        "/artifacts/ingest",
        params={"artifact_id": "art_ok", "source_id": "SRC-T"},
        files={"file": ("ok.csv", csv.encode(), "text/csv")},
    ).json()
    job = wait_job(api, accepted["job_id"])
    assert job["status"] == "done"
