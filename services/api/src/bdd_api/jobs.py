"""Background job execution for ingest pipelines.

Jobs are rows in the ``jobs`` table; work runs on a small thread pool so the
API stays responsive while large files parse. Each step transition is
persisted, which lets the UI animate real progress instead of a spinner.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from typing import Any

from bdd_api.config import Settings
from bdd_api.db import JobRow, db_session

logger = logging.getLogger("bdd.jobs")

_executor: ThreadPoolExecutor | None = None


def start_executor(settings: Settings) -> None:
    global _executor
    _executor = ThreadPoolExecutor(max_workers=settings.job_workers, thread_name_prefix="bdd-job")


def shutdown_executor() -> None:
    global _executor
    if _executor is not None:
        _executor.shutdown(wait=False, cancel_futures=True)
        _executor = None


def _now() -> datetime:
    return datetime.now(UTC)


def create_job(kind: str, steps: list[str]) -> tuple[str, list[dict[str, Any]]]:
    """Persist a queued job with its planned steps; returns (job_id, initial_steps)."""
    job_id = uuid.uuid4().hex[:16]
    step_rows: list[dict[str, Any]] = [{"name": name, "status": "pending", "detail": None} for name in steps]
    with db_session() as session:
        session.add(
            JobRow(
                job_id=job_id,
                kind=kind,
                status="queued",
                progress=0.0,
                steps_json=step_rows,
            )
        )
        session.commit()
    return job_id, step_rows


def get_job(job_id: str) -> JobRow | None:
    with db_session() as session:
        return session.get(JobRow, job_id)


def _update(job_id: str, mutate: Callable[[JobRow], None]) -> None:
    with db_session() as session:
        row = session.get(JobRow, job_id)
        if row is not None:
            mutate(row)
            session.commit()


def submit_job(job_id: str, work: Callable[[], dict[str, Any]]) -> None:
    """Run ``work`` on the pool; persist transitions and terminal status."""

    def run() -> None:
        _update(job_id, lambda r: setattr(r, "status", "running"))
        try:
            result = work()
        except Exception as exc:
            logger.exception("job %s failed", job_id)
            error_message = f"{type(exc).__name__}: {exc}"[:2000]
            step_detail = str(exc)[:300]

            def fail(row: JobRow) -> None:
                row.status = "failed"
                row.error = error_message
                # JSON columns don't track in-place mutation: reassign
                row.steps_json = [
                    ({**step, "status": "failed", "detail": step_detail} if step["status"] == "running" else step)
                    for step in row.steps_json
                ]

            _update(job_id, fail)
            return

        def done(row: JobRow) -> None:
            row.status = "done"
            row.progress = 100.0
            row.result_json = result

        _update(job_id, done)

    assert _executor is not None, "executor not started"
    _executor.submit(run)


class StepReporter:
    """Helper passed to pipeline functions for persisted step progress."""

    def __init__(self, job_id: str) -> None:
        self.job_id = job_id

    def start(self, name: str, detail: str | None = None) -> None:
        self._transition(name, "running", detail, advance_progress=False)

    def done(self, name: str, detail: str | None = None) -> None:
        self._transition(name, "done", detail, advance_progress=True)

    def fail(self, name: str, detail: str) -> None:
        self._transition(name, "failed", detail, advance_progress=False)

    def _steps(self) -> tuple[JobRow, list[dict[str, Any]]] | None:
        with db_session() as session:
            row = session.get(JobRow, self.job_id)
            return (row, row.steps_json) if row else None

    def _transition(self, name: str, status: str, detail: str | None, *, advance_progress: bool) -> None:
        def apply(row: JobRow) -> None:
            # JSON columns don't track in-place mutation: rebuild + reassign
            updated: list[dict[str, Any]] = []
            for step in row.steps_json:
                if step["name"] == name and step["status"] != "failed":
                    updated.append({**step, "status": status, "detail": detail})
                else:
                    updated.append(step)
            row.steps_json = updated
            total = max(len(updated), 1)
            finished = sum(1 for s in updated if s["status"] == "done")
            row.progress = round(100.0 * finished / total, 1)

        _update(self.job_id, apply)
