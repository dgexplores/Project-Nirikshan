"""Startup DB retries: transient blips recover, persistent outage fails fast."""

from __future__ import annotations

import pytest
import sqlalchemy.exc
from bdd_api.db import Engine


def _flaky_create_all(monkeypatch, failures_before_success: int) -> dict:
    calls = {"n": 0}

    def fake_create_all(engine):
        calls["n"] += 1
        if calls["n"] <= failures_before_success:
            raise sqlalchemy.exc.OperationalError("connect", None, Exception("refused"))

    monkeypatch.setattr("bdd_api.db.Base.metadata.create_all", fake_create_all)
    return calls


def test_create_all_recovers_after_transient_failures(monkeypatch):
    engine = Engine("sqlite:///:memory:")
    calls = _flaky_create_all(monkeypatch, failures_before_success=2)
    engine.create_all(retries=4, backoff_s=0)
    assert calls["n"] == 3


def test_create_all_raises_after_retries_exhausted(monkeypatch):
    engine = Engine("sqlite:///:memory:")
    calls = _flaky_create_all(monkeypatch, failures_before_success=99)
    with pytest.raises(RuntimeError, match="3 attempts"):
        engine.create_all(retries=3, backoff_s=0)
    assert calls["n"] == 3
