"""Gap-fix regression tests: all additive, existing behavior unchanged."""

from __future__ import annotations

import io
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def test_rolling_baseline_flags_spike_but_ignores_flat() -> None:
    from bdd_forensics.anomaly import detect_rolling_baseline

    spike = detect_rolling_baseline(metric="amount", values=[10.0, 11.0, 9.0, 10.0, 200.0], window=3)
    assert len(spike) == 1
    assert spike[0].observed == 200.0
    assert spike[0].method == "rolling_baseline"

    flat = detect_rolling_baseline(metric="amount", values=[10.0, 10.0, 10.0, 10.0, 10.0], window=3)
    assert flat == []

    short = detect_rolling_baseline(metric="amount", values=[1.0, 500.0], window=3)
    assert short == []  # not enough prior points to judge


def test_stale_jobs_recovered_as_failed(api: TestClient) -> None:
    from bdd_api.jobs import create_job, get_job, recover_stale_jobs

    job_id, _ = create_job("ingest", ["step-a", "step-b"])
    assert get_job(job_id) is not None
    assert recover_stale_jobs() >= 1
    row = get_job(job_id)
    assert row is not None and row.status == "failed"
    assert "restart" in (row.error or "")


def test_schema_version_stamped(api: TestClient) -> None:
    from bdd_api.db import SCHEMA_VERSION, SchemaVersion, db_session

    with db_session() as session:
        assert session.get(SchemaVersion, SCHEMA_VERSION) is not None


def test_case_export_bundle(api: TestClient) -> None:
    resp = api.post(
        "/artifacts/ingest",
        params={"artifact_id": "art_export", "source_id": "SRC-TEST"},
        files={"file": ("d.csv", io.BytesIO(b"district,value\nA,1\nB,2\n"), "text/csv")},
    )
    assert resp.status_code == 202, resp.text
    from conftest import wait_job

    wait_job(api, resp.json()["job_id"])
    out = api.get("/cases/art_export/export")
    assert out.status_code == 200, out.text
    body = out.json()
    assert body["artifact_id"] == "art_export"
    assert body["manifest"]["sha256"]
    assert body["finding_count"] == len(body["findings"])

    missing = api.get("/cases/nope/export")
    assert missing.status_code == 404


@pytest.fixture()
def keyed_api(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("BDD_DATABASE_URL", f"sqlite:///{tmp_path / 'keyed.db'}")
    monkeypatch.setenv("BDD_RAW_STORE", str(tmp_path / "raw"))
    monkeypatch.setenv("BDD_MANIFEST_DIR", str(tmp_path / "manifests"))
    monkeypatch.setenv("BDD_FIXTURES_DIR", str(tmp_path / "fixtures"))
    monkeypatch.setenv("BDD_CORS_ORIGINS", "http://localhost:3000")
    monkeypatch.setenv("BDD_API_KEY", "test-key-123")
    from bdd_api import config

    config.get_settings.cache_clear()
    from bdd_api import db

    db._engine = None
    from bdd_api.jobs import shutdown_executor, start_executor
    from bdd_api.main import create_app

    settings = config.get_settings()
    assert settings.api_key == "test-key-123"
    settings.ensure_dirs()
    start_executor(settings)
    with TestClient(create_app()) as client:
        yield client
    shutdown_executor()
    config.get_settings.cache_clear()


def test_api_key_gate_blocks_but_leaves_health_open(keyed_api: TestClient) -> None:
    assert keyed_api.get("/health").status_code == 200
    assert keyed_api.get("/health/ready").status_code == 200

    denied = keyed_api.get("/artifacts")
    assert denied.status_code == 401
    assert denied.json()["error"]["code"] == "unauthorized"

    allowed = keyed_api.get("/artifacts", headers={"X-API-Key": "test-key-123"})
    assert allowed.status_code == 200
