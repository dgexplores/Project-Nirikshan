"""BDD API service.

Sprint 1: health, artifact ingest (manifest + profile) with an in-memory
registry. Persistence lands with the Postgres schema in a later sprint.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from bdd_contracts.artifact import ArtifactManifest, SourceInfo
from bdd_contracts.profile import DatasetProfile
from bdd_forensics.profiler import profile_dataset
from bdd_ingestion.manifest import build_manifest
from bdd_ingestion.parsers import ParseError, read_artifact
from fastapi import FastAPI, File, HTTPException, Query, UploadFile

app = FastAPI(title="Bharat Data Detective API", version="0.1.0")

# In-memory registry: artifact_id -> {manifest, profile}
_REGISTRY: dict[str, dict] = {}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "bdd-api"}


@app.post("/artifacts/ingest", status_code=201)
async def ingest_artifact(
    file: UploadFile = File(...),  # noqa: B008
    *,
    artifact_id: str = Query(..., description="Unique artifact id"),
    source_id: str = Query(..., description="Stable source id"),
    title: str | None = Query(default=None),
) -> dict:
    if artifact_id in _REGISTRY:
        raise HTTPException(status_code=409, detail=f"artifact {artifact_id} exists")

    suffix = Path(file.filename or "upload.csv").suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)

    try:
        df, parser_name = read_artifact(tmp_path)
        manifest: ArtifactManifest = build_manifest(
            artifact_id=artifact_id,
            src=tmp_path,
            raw_store=Path("data/raw"),
            source=SourceInfo(source_id=source_id, official_title=title),
            parser_name=parser_name,
        )
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    profile: DatasetProfile = profile_dataset(
        dataset_id=f"ds-{artifact_id}", artifact_id=artifact_id, df=df
    )
    _REGISTRY[artifact_id] = {"manifest": manifest, "profile": profile}
    return {"artifact_id": artifact_id, "manifest": manifest, "profile": profile}


@app.get("/artifacts/{artifact_id}/manifest")
def get_manifest(artifact_id: str) -> ArtifactManifest:
    entry = _REGISTRY.get(artifact_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="artifact not found")
    return entry["manifest"]


@app.get("/artifacts/{artifact_id}/profile")
def get_profile(artifact_id: str) -> DatasetProfile:
    entry = _REGISTRY.get(artifact_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="artifact not found")
    return entry["profile"]