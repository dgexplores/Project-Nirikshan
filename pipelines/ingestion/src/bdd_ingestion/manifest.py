"""Manifest generation: immutable artifact capture with SHA-256 hashing."""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path

import polars as pl
from bdd_contracts.artifact import ArtifactManifest, ParserInfo, SourceInfo

CHUNK = 1024 * 1024


def parser_config_hash(*, parser_name: str, config: dict) -> str:
    """SHA-256 of parser name + pinned config. Binds manifest to its reader."""
    payload = json.dumps(
        {"parser": parser_name, **config},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def parser_info(name: str, config: dict) -> ParserInfo:
    """Parser identity: library version plus a config hash for reproducibility."""
    return ParserInfo(
        name=name,
        version=pl.__version__,
        config_hash=parser_config_hash(parser_name=name, config=config),
    )


def sha256_file(path: Path) -> str:
    """Compute SHA-256 of a file in chunks."""
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while chunk := fh.read(CHUNK):
            digest.update(chunk)
    return digest.hexdigest()


def freeze_copy(src: Path, raw_store: Path) -> Path:
    """Copy artifact into the immutable raw store. Never overwrites."""
    raw_store.mkdir(parents=True, exist_ok=True)
    target = raw_store / src.name
    if target.exists():
        existing = sha256_file(target)
        new = sha256_file(src)
        if existing == new:
            return target
        stem, suffix = src.stem, src.suffix
        target = raw_store / f"{stem}-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}{suffix}"
    shutil.copy2(src, target)
    return target


def build_manifest(
    *,
    artifact_id: str,
    src: Path,
    raw_store: Path,
    source: SourceInfo | None = None,
    parser_name: str = "polars",
    parser_config: dict | None = None,
    media_type: str = "text/csv",
    release_date: str | None = None,
) -> ArtifactManifest:
    """Freeze source file into raw store and build its manifest."""
    raw_path = freeze_copy(src, raw_store)
    return ArtifactManifest(
        artifact_id=artifact_id,
        source=source or SourceInfo(source_id="unregistered"),
        retrieved_at=datetime.now(UTC),
        sha256=sha256_file(raw_path),
        media_type=media_type,
        byte_size=raw_path.stat().st_size,
        parser=parser_info(parser_name, parser_config or {}),
        release_date=release_date,
        raw_uri=str(raw_path),
    )