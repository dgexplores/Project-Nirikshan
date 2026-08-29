"""HTTP routers: thin validation over pipelines/services. One module keeps the
surface small and reviewable; every handler maps errors to the shared envelope.
"""

from __future__ import annotations

import tempfile
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from bdd_contracts.lineage import LineageGraph
from bdd_forensics.lineage import build_lineage
from fastapi import APIRouter, File, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from bdd_api.ask import ask as ask_service
from bdd_api.config import get_settings
from bdd_api.db import ALLOWED_REVIEW_STATUSES, ArtifactRow, FindingRow, db_session
from bdd_api.errors import AppError, ConflictError, NotFoundError
from bdd_api.jobs import StepReporter, create_job, get_job, submit_job
from bdd_api.pipelines import (
    INGEST_STEPS,
    run_anomalies,
    run_compare,
    run_ingest,
    validate_upload_filename,
)

router = APIRouter()

# Reserve artifact ids between request-time and worker-persist time so
# concurrent double-submits get a deterministic 409 instead of a clobber.
# Lock is module-level and shared across requests, a per-request lock would
# be uncontended by construction and enforce nothing.
_INFLIGHT: set[str] = set()
_INFLIGHT_LOCK = threading.Lock()


# ---------- health ----------


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    return {"status": "ok", "service": "bdd-api", "version": settings.app_version}


@router.get("/health/ready")
def ready() -> dict:
    from bdd_api.db import get_engine

    db_ok = get_engine().ping()
    return {"status": "ready" if db_ok else "degraded", "database": db_ok}


# ---------- artifacts + ingest ----------


class IngestAccepted(BaseModel):
    artifact_id: str
    job_id: str
    status: str = "queued"


@router.post("/artifacts/ingest", status_code=202, response_model=IngestAccepted)
async def ingest_artifact(
    file: UploadFile = File(...),  # noqa: B008
    *,
    artifact_id: str = Query(..., min_length=3, max_length=128, description="Unique artifact id"),
    source_id: str = Query(..., min_length=2, max_length=128),
    title: str | None = Query(default=None, max_length=300),
    release_date: str | None = Query(default=None, description="Release/period label e.g. FY 2024-25"),
) -> IngestAccepted:
    validate_upload_filename(file.filename or "")
    settings = get_settings()

    with db_session() as session:
        exists = session.get(ArtifactRow, artifact_id) is not None
    with _INFLIGHT_LOCK:
        if exists or artifact_id in _INFLIGHT:
            raise ConflictError("artifact_exists", f"artifact {artifact_id} already exists")
        _INFLIGHT.add(artifact_id)

    suffix = Path(file.filename or "upload.csv").suffix
    tmp_dir = Path(tempfile.mkdtemp(prefix="bdd-upload-"))
    tmp_path = tmp_dir / f"upload{suffix}"
    size = 0
    try:
        with tmp_path.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise AppError(
                        413,
                        "payload_too_large",
                        f"upload exceeds {settings.max_upload_mb} MB limit",
                    )
                out.write(chunk)
        if size == 0:
            raise AppError(422, "empty_file", "uploaded file is empty")
    except Exception:
        import shutil

        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise

    job_id, _steps = create_job("ingest", INGEST_STEPS)
    reporter = StepReporter(job_id)

    def work() -> dict[str, Any]:
        try:
            return run_ingest(
                tmp_path=tmp_path,
                original_filename=file.filename or "upload.csv",
                artifact_id=artifact_id,
                source_id=source_id,
                title=title,
                release_date=release_date,
                settings=settings,
                reporter=reporter,
            )
        finally:
            # worker owns the temp lifecycle: the job may outlive this request
            import shutil

            shutil.rmtree(tmp_dir, ignore_errors=True)
            _INFLIGHT.discard(artifact_id)

    submit_job(job_id, work)
    return IngestAccepted(artifact_id=artifact_id, job_id=job_id)


@router.get("/artifacts")
def list_artifacts(limit: int = Query(default=100, le=500), offset: int = Query(default=0, ge=0)) -> dict:
    with db_session() as session:
        total = session.scalar(select(func.count()).select_from(ArtifactRow)) or 0
        rows = session.scalars(select(ArtifactRow).order_by(ArtifactRow.created_at.desc()).limit(limit).offset(offset)).all()
        items = []
        for row in rows:
            profile = row.profile_json or {}
            fitness = row.fitness_json or {}
            items.append(
                {
                    "artifact_id": row.artifact_id,
                    "source_id": row.source_id,
                    "title": row.title,
                    "sha256": row.sha256,
                    "media_type": row.media_type,
                    "byte_size": row.byte_size,
                    "release_date": row.release_date,
                    "row_count": profile.get("row_count"),
                    "column_count": profile.get("column_count"),
                    "quality_flag_count": len(profile.get("quality_observations", [])),
                    "fitness_score": fitness.get("score"),
                    "fitness_grade": fitness.get("grade"),
                    "created_at": row.created_at.isoformat(),
                }
            )
    return {"total": total, "items": items}


def _require_artifact(session: Any, artifact_id: str) -> ArtifactRow:
    row = session.get(ArtifactRow, artifact_id)
    if row is None:
        raise NotFoundError("artifact_not_found", f"artifact {artifact_id} not found (it may still be processing - check its job)")
    return row


@router.get("/artifacts/{artifact_id}/manifest")
def get_manifest(artifact_id: str) -> dict:
    with db_session() as session:
        row = _require_artifact(session, artifact_id)
    return row.manifest_json


@router.get("/artifacts/{artifact_id}/profile")
def get_profile(artifact_id: str) -> dict:
    with db_session() as session:
        row = _require_artifact(session, artifact_id)
    if row.profile_json is None:
        raise AppError(409, "profile_pending", "profile not ready; ingest job may still be running")
    return row.profile_json


@router.get("/artifacts/{artifact_id}/fitness")
def get_fitness(artifact_id: str) -> dict:
    with db_session() as session:
        row = _require_artifact(session, artifact_id)
    if row.fitness_json is None:
        raise AppError(409, "fitness_pending", "fitness score not ready yet")
    return row.fitness_json


@router.get("/artifacts/{artifact_id}/lineage", response_model=LineageGraph)
def get_lineage(artifact_id: str) -> LineageGraph:
    """Evidence lineage: raw artifact -> parser -> profile -> rules -> findings."""
    from bdd_contracts.anomaly import AnomalyFinding, ContradictionFinding, DriftFinding
    from bdd_contracts.consensus import ConsensusFinding

    with db_session() as session:
        row = _require_artifact(session, artifact_id)
        manifest_json = row.manifest_json
        profile_json = row.profile_json
        finding_rows = list(
            session.scalars(select(FindingRow).order_by(FindingRow.created_at.asc()).limit(1000)).unique().all()
        )

    from bdd_contracts.artifact import ArtifactManifest
    from bdd_contracts.profile import DatasetProfile

    manifest = ArtifactManifest.model_validate(manifest_json)
    profile = DatasetProfile.model_validate(profile_json) if profile_json else None

    findings: list[Any] = []
    for frow in finding_rows:
        if artifact_id not in set(map(str, frow.artifact_ids or [])):
            continue
        payload = frow.payload_json
        model = {
            "anomaly": AnomalyFinding,
            "contradiction": ContradictionFinding,
            "drift": DriftFinding,
            "consensus": ConsensusFinding,
        }.get(frow.kind)
        if model is not None:
            findings.append(model.model_validate(payload))

    graph = build_lineage(manifest, profile, findings)
    return graph


# ---------- jobs ----------


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str) -> dict:
    row = get_job(job_id)
    if row is None:
        raise NotFoundError("job_not_found", f"job {job_id} not found")
    return {
        "job_id": row.job_id,
        "kind": row.kind,
        "status": row.status,
        "progress": row.progress,
        "steps": row.steps_json,
        "result": row.result_json,
        "error": row.error,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


# ---------- compare ----------


class CompareRequest(BaseModel):
    artifact_a: str
    column_a: str
    artifact_b: str
    column_b: str


@router.post("/compare")
def compare(req: CompareRequest) -> dict:
    return run_compare(req.artifact_a, req.column_a, req.artifact_b, req.column_b)


# ---------- findings ----------


@router.get("/findings")
def list_findings(
    severity: str | None = None,
    kind: str | None = None,
    status: str | None = None,
    q: str | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    with db_session() as session:
        query = select(FindingRow).order_by(FindingRow.created_at.desc())  # type: ignore[attr-defined]
        if severity:
            query = query.where(FindingRow.severity == severity)
        if kind:
            query = query.where(FindingRow.kind == kind)
        if status:
            query = query.where(FindingRow.status == status)
        if q:
            like = f"%{q.lower()}%"
            query = query.where(func.lower(FindingRow.title).like(like) | func.lower(FindingRow.summary).like(like))
        total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = session.scalars(query.limit(limit).offset(offset)).unique().all()
        items = [
            {
                "id": r.finding_id,
                "kind": r.kind,
                "severity": r.severity,
                "confidence": r.confidence,
                "status": r.status,
                "title": r.title,
                "summary": r.summary,
                "artifact_ids": r.artifact_ids,
                "created_at": r.created_at.isoformat(),
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "reviewer_note": r.reviewer_note,
            }
            for r in rows
        ]
    return {"total": total, "items": items}


class FindingDetail(BaseModel):
    id: str
    kind: str
    severity: str
    confidence: str
    status: str
    title: str
    summary: str
    payload: dict[str, Any]
    artifact_ids: list[str]
    created_at: str
    reviewed_at: str | None = None
    reviewer_note: str | None = None


@router.get("/findings/{finding_id}", response_model=FindingDetail)
def get_finding(finding_id: str) -> FindingDetail:
    with db_session() as session:
        row = session.get(FindingRow, finding_id)
        if row is None:
            raise NotFoundError("finding_not_found", f"finding {finding_id} not found")
        return FindingDetail(
            id=row.finding_id,
            kind=row.kind,
            severity=row.severity,
            confidence=row.confidence,
            status=row.status,
            title=row.title,
            summary=row.summary,
            payload=row.payload_json,
            artifact_ids=list(map(str, row.artifact_ids or [])),
            created_at=row.created_at.isoformat(),
            reviewed_at=row.reviewed_at.isoformat() if row.reviewed_at else None,
            reviewer_note=row.reviewer_note,
        )


class ReviewRequest(BaseModel):
    status: str
    note: str | None = Field(default=None, max_length=2000)


@router.post("/findings/{finding_id}/review")
def review_finding(finding_id: str, req: ReviewRequest) -> dict:
    if req.status not in ALLOWED_REVIEW_STATUSES:
        allowed = ", ".join(sorted(ALLOWED_REVIEW_STATUSES))
        raise AppError(422, "invalid_status", f"status must be one of: {allowed}")
    with db_session() as session:
        row = session.get(FindingRow, finding_id)
        if row is None:
            raise NotFoundError("finding_not_found", f"finding {finding_id} not found")
        row.status = req.status
        row.reviewed_at = datetime.now(UTC)
        if req.note is not None:
            row.reviewer_note = req.note
        session.commit()
    return {"id": finding_id, "status": req.status}


@router.post("/artifacts/{artifact_id}/analyze")
def analyze_artifact(artifact_id: str) -> dict:
    """Re-run anomaly engines over a stored artifact (deterministic, idempotent)."""
    written = run_anomalies(artifact_id)
    return {"artifact_id": artifact_id, "findings_written": written}


# ---------- ask detective ----------


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    artifact_ids: list[str] | None = None


@router.post("/ask")
def ask_detective(req: AskRequest) -> dict:
    return ask_service(req.question, req.artifact_ids)


# ---------- demo seed (synthetic public fixtures) ----------


@router.post("/seed/demo")
def seed_demo_endpoint() -> dict:
    from bdd_api.seed import seed_demo

    return seed_demo()


# ---------- dashboard ----------


@router.get("/dashboard/summary")
def dashboard_summary() -> dict:
    with db_session() as session:
        n_artifacts = session.scalar(select(func.count()).select_from(ArtifactRow)) or 0
        rows = session.scalars(select(ArtifactRow).order_by(ArtifactRow.created_at.desc())).all()
        total_rows = sum(int((r.profile_json or {}).get("row_count") or 0) for r in rows)
        bytes_total = sum(r.byte_size for r in rows)
        avg_fitness = None
        grades = [r.fitness_json for r in rows if r.fitness_json]
        if grades:
            avg_fitness = round(sum(g["score"] for g in grades) / len(grades), 1)

        by_severity: dict[str, int] = {}
        by_kind: dict[str, int] = {}
        open_reviews = 0
        recent_items: list[dict] = []
        for frow in session.scalars(select(FindingRow).order_by(FindingRow.created_at.desc()).limit(1000)).unique().all():
            by_severity[frow.severity] = by_severity.get(frow.severity, 0) + 1
            by_kind[frow.kind] = by_kind.get(frow.kind, 0) + 1
            if frow.status == "open":
                open_reviews += 1
            if len(recent_items) < 6:
                recent_items.append(
                    {
                        "id": frow.finding_id,
                        "kind": frow.kind,
                        "severity": frow.severity,
                        "title": frow.title,
                        "summary": frow.summary[:180],
                        "status": frow.status,
                        "created_at": frow.created_at.isoformat(),
                    }
                )
        recent_artifacts = [
            {
                "artifact_id": r.artifact_id,
                "title": r.title or r.source_id,
                "row_count": (r.profile_json or {}).get("row_count"),
                "fitness_grade": (r.fitness_json or {}).get("grade"),
                "created_at": r.created_at.isoformat(),
            }
            for r in rows[:5]
        ]
    return {
        "artifacts": n_artifacts,
        "rows_total": total_rows,
        "bytes_total": bytes_total,
        "avg_fitness": avg_fitness,
        "findings_total": sum(by_severity.values()),
        "by_severity": by_severity,
        "by_kind": by_kind,
        "open_reviews": open_reviews,
        "recent_findings": recent_items,
        "recent_artifacts": recent_artifacts,
    }
