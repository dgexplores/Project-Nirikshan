"""Ingestion + forensic pipelines executed inside background jobs.

``run_ingest``    : save -> parse -> freeze -> profile -> fitness -> persist
``run_compare``   : comparability gates + numeric reconciliation + definition drift
``run_anomalies`` : anomaly engines over one stored artifact

All findings are stored as unified rows so the UI has one queue to filter.
Finding ids are deterministic (hash of payload + scope) so reruns are
idempotent - a governance requirement.
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

from bdd_contracts.anomaly import AnomalyFinding, ContradictionFinding, DriftFinding
from bdd_contracts.artifact import ArtifactManifest, SourceInfo
from bdd_contracts.consensus import ConsensusFinding
from bdd_contracts.profile import DatasetProfile
from bdd_forensics.anomaly import detect_iqr, detect_yoy, detect_zscore
from bdd_forensics.definitions import infer_definition_cards
from bdd_forensics.drift import detect_definition_drift
from bdd_forensics.fitness import compute_fitness
from bdd_forensics.profiler import profile_dataset
from bdd_ingestion.manifest import build_manifest
from bdd_ingestion.parsers import ParseError, read_artifact

from bdd_api.config import SUPPORTED_EXTENSIONS, Settings
from bdd_api.db import ArtifactRow, FindingRow, db_session
from bdd_api.errors import AppError
from bdd_api.jobs import StepReporter

logger = logging.getLogger("bdd.pipelines")

INGEST_STEPS = ["receive_upload", "parse", "freeze_manifest", "profile", "fitness", "persist"]


def stable_finding_id(kind: str, payload_json: dict[str, Any], scope: str) -> str:
    """Deterministic id: same inputs -> same finding row (idempotent reruns)."""
    canonical = json.dumps(payload_json, sort_keys=True, default=str)
    digest = hashlib.sha256(f"{scope}|{canonical}".encode()).hexdigest()[:12]
    return f"{kind}-{digest}"


def _title_and_summary(payload: Any) -> tuple[str, str]:
    if isinstance(payload, AnomalyFinding):
        pct = abs(payload.observed - payload.expected) / max(abs(payload.expected), 1e-9) * 100
        return (
            f"{payload.metric} outlier ({payload.method})",
            f"Observed {payload.observed:g} vs expected {payload.expected:g} ({pct:.0f} off) in slice {json.dumps(payload.slice, default=str)}",
        )
    if isinstance(payload, DriftFinding):
        return (
            f"Semantic drift: {payload.drift_type} on {payload.concept_id}",
            f"{payload.comparability_decision} comparison (semantic impact {payload.semantic_impact:.2f}); evidence: {'; '.join(payload.evidence)}",
        )
    if isinstance(payload, ContradictionFinding):
        va, vb = payload.claim_a.get("value"), payload.claim_b.get("value")
        verb = {
            "conflict": "Contradiction between sources",
            "explainable": "Explainable difference between sources",
            "not_comparable": "Pair not comparable",
        }[payload.reconciliation_status]
        return (
            verb,
            f"Claim A={va} vs claim B={vb}; alignment tests: {json.dumps(payload.alignment_tests, default=str)}",
        )
    if isinstance(payload, ConsensusFinding):
        verdict_text = (
            "Independent corroboration"
            if payload.verdict == "independent_corroboration"
            else "Shared origin suspected"
        )
        return (
            f"{verdict_text}: {payload.metric}",
            (f"{payload.apparent_sources} apparent source(s) trace to "
             f"{payload.distinct_origins} distinct origin(s); diversity ratio {payload.diversity_ratio:.2f}"),
        )
    return ("finding", json.dumps(payload, default=str)[:500])


def persist_findings(
    payloads: list[Any],
    artifact_ids: list[str],
    kinds: list[str],
    job_id: str | None,
) -> int:
    """Insert new findings only; identical payloads keep their stable ids."""
    written = 0
    with db_session() as session:
        for payload, kind in zip(payloads, kinds, strict=True):
            payload_json = json.loads(payload.model_dump_json())
            fid = stable_finding_id(kind, payload_json, "|".join(sorted(artifact_ids)))
            if session.get(FindingRow, fid) is not None:
                continue
            title, summary = _title_and_summary(payload)
            session.add(
                FindingRow(
                    finding_id=fid,
                    kind=kind,
                    severity=payload.severity,
                    confidence=getattr(payload, "confidence", "moderate"),
                    status="open",
                    title=title,
                    summary=summary,
                    payload_json=payload_json,
                    artifact_ids=artifact_ids,
                    job_id=job_id,
                )
            )
            written += 1
        session.commit()
    return written


def run_ingest(
    tmp_path: Path,
    original_filename: str,
    artifact_id: str,
    source_id: str,
    title: str | None,
    release_date: str | None,
    settings: Settings,
    reporter: StepReporter,
) -> dict[str, Any]:
    """Full ingest pipeline. Raises AppError on user-facing failures."""
    reporter.start("receive_upload", original_filename)
    media_type = settings.media_type_for(original_filename)
    reporter.done("receive_upload", media_type)

    reporter.start("parse")
    try:
        df, parser_name = read_artifact(tmp_path)
    except ParseError as exc:
        reporter.fail("parse", str(exc))
        raise AppError(422, "parse_error", str(exc)) from exc
    reporter.done("parse", f"{parser_name}: {df.height} rows x {df.width} cols")

    reporter.start("freeze_manifest")
    manifest: ArtifactManifest = build_manifest(
        artifact_id=artifact_id,
        src=tmp_path,
        raw_store=settings.raw_store,
        source=SourceInfo(source_id=source_id, official_title=title),
        parser_name=parser_name,
        media_type=media_type,
        release_date=release_date,
    )
    manifest_path = settings.manifest_dir / f"{artifact_id}.json"
    manifest_path.write_text(json.dumps(json.loads(manifest.model_dump_json()), indent=2) + "\n")
    reporter.done("freeze_manifest", f"sha256 {manifest.sha256[:16]}...")

    reporter.start("profile")
    profile: DatasetProfile = profile_dataset(dataset_id=f"ds-{artifact_id}", artifact_id=artifact_id, df=df)
    reporter.done("profile", f"{len(profile.quality_observations)} quality observation(s)")

    reporter.start("fitness")
    fitness = compute_fitness(profile)
    reporter.done("fitness", f"score {fitness.score:.1f} grade {fitness.grade}")

    reporter.start("persist")
    with db_session() as session:
        session.merge(
            ArtifactRow(
                artifact_id=artifact_id,
                source_id=source_id,
                title=title,
                sha256=manifest.sha256,
                media_type=media_type,
                byte_size=manifest.byte_size,
                raw_uri=manifest.raw_uri,
                release_date=release_date,
                manifest_json=json.loads(manifest.model_dump_json()),
                profile_json=json.loads(profile.model_dump_json()),
                fitness_json=json.loads(fitness.model_dump_json()),
            )
        )
        session.commit()
    reporter.done("persist")

    return {
        "artifact_id": artifact_id,
        "sha256": manifest.sha256,
        "rows": profile.row_count,
        "columns": profile.column_count,
        "fitness_score": fitness.score,
        "fitness_grade": fitness.grade,
    }


def load_dataframe(raw_uri: str):
    """Re-read a stored artifact with the versioned parser chain."""
    path = Path(raw_uri)
    if not path.exists():
        raise AppError(410, "raw_artifact_missing", f"frozen artifact missing at {path}")
    try:
        df, _ = read_artifact(path)
    except ParseError as exc:
        raise AppError(500, "reparse_failed", f"stored artifact failed to re-parse: {exc}") from exc
    return df


def _find_column(profile: DatasetProfile, tokens: list[str]) -> str | None:
    lowered = [(c.name.lower(), c.name) for c in profile.columns]
    for token in tokens:
        for low, orig in lowered:
            if token in low:
                return orig
    return None


def _unit_for_column(profile: DatasetProfile, column: str) -> str:
    for card in infer_definition_cards(profile):
        span = card.evidence_spans[0] if card.evidence_spans else ""
        if span.endswith(f"column={column}"):
            return card.unit
    return "count"


def run_compare(
    artifact_a: str,
    column_a: str,
    artifact_b: str,
    column_b: str,
    job_id: str | None = None,
) -> dict[str, Any]:
    """Gate two artifacts, reconcile chosen numeric totals, detect drift."""
    from bdd_forensics.comparability import build_comparability
    from bdd_forensics.cross_source import investigate

    with db_session() as session:
        row_a = session.get(ArtifactRow, artifact_a)
        row_b = session.get(ArtifactRow, artifact_b)
    missing = [name for name, row in (("a", row_a), ("b", row_b)) if row is None]
    if missing:
        raise AppError(404, "artifact_not_found", f"unknown artifact(s): {', '.join(missing)}")
    assert row_a is not None and row_b is not None

    def total_of(row: ArtifactRow, column: str, profile: DatasetProfile) -> float:
        col = next((c for c in profile.columns if c.name == column), None)
        if col is None:
            raise AppError(422, "column_not_found", f"column '{column}' not found in {row.artifact_id}")
        df = load_dataframe(row.raw_uri)
        if column not in df.columns:
            raise AppError(422, "column_not_found", f"column '{column}' not found in frozen data of {row.artifact_id}")
        vals = df[column].drop_nulls()
        if not vals.len():
            raise AppError(422, "empty_column", f"column '{column}' in {row.artifact_id} has no values")
        import polars as pl

        return float(vals.cast(pl.Float64, strict=False).sum())

    profile_a = DatasetProfile.model_validate(row_a.profile_json or {"dataset_id": "?", "artifact_id": artifact_a, "row_count": 0, "column_count": 0, "columns": [], "duplicate_rows": 0, "quality_observations": [], "candidate_keys": [], "profile_version": "?"})
    profile_b = DatasetProfile.model_validate(row_b.profile_json or {"dataset_id": "?", "artifact_id": artifact_b, "row_count": 0, "column_count": 0, "columns": [], "duplicate_rows": 0, "quality_observations": [], "candidate_keys": [], "profile_version": "?"})

    geo_tokens = ["district", "state", "village", "block", "city"]
    geo_col_a = _find_column(profile_a, geo_tokens)
    geo_col_b = _find_column(profile_b, geo_tokens)

    total_a = total_of(row_a, column_a, profile_a)
    total_b = total_of(row_b, column_b, profile_b)

    fy_a = (getattr(row_a, "release_date", None) or "").strip() or None
    fy_b = (getattr(row_b, "release_date", None) or "").strip() or None

    unit_a = _unit_for_column(profile_a, column_a)
    unit_b = _unit_for_column(profile_b, column_b)
    cards_a = infer_definition_cards(profile_a)
    cards_b = infer_definition_cards(profile_b)
    concept_a = next((c.concept_id for c in cards_a if column_a in str(c.evidence_spans)), column_a)
    concept_b = next((c.concept_id for c in cards_b if column_b in str(c.evidence_spans)), column_b)
    definition_a = concept_a.split("_per_")[0].split("_")[0] if concept_a else None
    definition_b = concept_b.split("_per_")[0].split("_")[0] if concept_b else None

    df_a = load_dataframe(row_a.raw_uri)
    df_b = load_dataframe(row_b.raw_uri)

    report = build_comparability(
        left_df=df_a,
        right_df=df_b,
        left_district_col=geo_col_a or "__none__",
        right_district_col=geo_col_b or "__none__",
        left_fy=fy_a,
        right_fy=fy_b,
        left_unit=unit_a,
        right_unit=unit_b,
        left_definition=definition_a,
        right_definition=definition_b,
    )

    contradiction: ContradictionFinding = investigate(
        finding_id="cmp-pending",
        claim_a={"source_id": artifact_a, "metric": column_a, "value": total_a},
        claim_b={"source_id": artifact_b, "metric": column_b, "value": total_b},
        left_df=df_a,
        right_df=df_b,
        left_district_col=geo_col_a or "__none__",
        right_district_col=geo_col_b or "__none__",
        left_fy=fy_a,
        right_fy=fy_b,
        left_unit=unit_a,
        right_unit=unit_b,
        left_definition=definition_a,
        right_definition=definition_b,
    )

    drift_findings: list[DriftFinding] = []
    by_concept_a = {c.concept_id: c for c in cards_a}
    for card_b in cards_b:
        card_a = by_concept_a.get(card_b.concept_id)
        if card_a is not None and card_a.card_id != card_b.card_id:
            drift_findings.extend(
                detect_definition_drift(before=card_a, after=card_b)  # type: ignore[call-arg]
            )

    payloads: list[Any] = [contradiction, *drift_findings]
    kinds: list[str] = ["contradiction"] + ["drift"] * len(drift_findings)
    scope_ids = sorted({artifact_a, artifact_b})
    persist_findings(payloads, scope_ids, kinds, job_id)

    overall_state = report["overall"]["state"] if report else "unknown"
    gates = [
        {"dimension": dim, "state": entry["state"], "reason": entry["reason"]}
        for dim, entry in (report or {}).items()
        if dim != "overall"
    ]
    return {
        "overall": overall_state,
        "gates": gates,
        "totals": {
            artifact_a: {"column": column_a, "total": total_a},
            artifact_b: {"column": column_b, "total": total_b},
        },
        "contradiction": json.loads(contradiction.model_dump_json()),
        "drift_findings": [json.loads(d.model_dump_json()) for d in drift_findings],
    }


def run_anomalies(artifact_id: str, job_id: str | None = None) -> int:
    """Run z-score/IQR (+ YoY when period+entity columns exist) on an artifact."""
    with db_session() as session:
        row = session.get(ArtifactRow, artifact_id)
    if row is None:
        raise AppError(404, "artifact_not_found", f"unknown artifact {artifact_id}")
    profile = DatasetProfile.model_validate(row.profile_json) if row.profile_json else None
    if profile is None or not profile.columns:
        return 0

    df = load_dataframe(row.raw_uri)
    value_cols = [c.name for c in profile.columns if c.dtype.startswith(("Int", "Float"))]
    entity_col = _find_column(profile, ["district", "state", "village", "entity"])
    period_col = _find_column(profile, ["year", "fy", "period"])

    findings: list[AnomalyFinding] = []
    for value_col in value_cols:
        findings.extend(detect_zscore(metric=value_col, df=df, value_col=value_col, key_col=entity_col))
        findings.extend(detect_iqr(metric=value_col, df=df, value_col=value_col))
        if entity_col and period_col:
            findings.extend(
                detect_yoy(metric=value_col, df=df, value_col=value_col, period_col=period_col, entity_col=entity_col)  # type: ignore[arg-type]
            )

    # Engine ids are per-call local ("an-000"); re-key deterministically so
    # ids stay unique across columns/methods and stable across reruns.
    findings = [
        f.model_copy(update={"finding_id": f"{f.method}-{f.metric}-{idx:03d}"})
        for idx, f in enumerate(findings)
    ]

    return persist_findings(findings, [artifact_id], ["anomaly"] * len(findings), job_id)


def validate_upload_filename(filename: str) -> None:
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise AppError(400, "unsupported_format", f"unsupported file type '{ext}'. supported: {supported}")
