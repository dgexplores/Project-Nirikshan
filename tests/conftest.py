"""Shared API test fixtures: isolated settings + DB per test."""

from __future__ import annotations

import time
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def api(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("BDD_DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("BDD_RAW_STORE", str(tmp_path / "raw"))
    monkeypatch.setenv("BDD_MANIFEST_DIR", str(tmp_path / "manifests"))
    monkeypatch.setenv("BDD_FIXTURES_DIR", str(tmp_path / "fixtures"))
    monkeypatch.setenv("BDD_CORS_ORIGINS", "http://localhost:3000")

    from bdd_api import config

    config.get_settings.cache_clear()

    from bdd_api import db

    db._engine = None  # reset module-global engine between tests

    from bdd_api.jobs import shutdown_executor, start_executor
    from bdd_api.main import create_app

    settings = config.get_settings()
    settings.ensure_dirs()
    start_executor(settings)
    with TestClient(create_app()) as test_client:
        yield test_client
    shutdown_executor()
    config.get_settings.cache_clear()


def wait_job(client: TestClient, job_id: str, timeout_s: float = 20.0) -> dict:
    """Poll a job until it reaches a terminal state."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        resp = client.get(f"/jobs/{job_id}")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        if body["status"] in {"done", "failed"}:
            return body
        time.sleep(0.05)
    raise AssertionError(f"job {job_id} did not finish within {timeout_s}s")
