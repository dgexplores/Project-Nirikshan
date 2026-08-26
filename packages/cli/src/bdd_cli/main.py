"""``bdd`` - one command line for the whole platform.

Talks to the database and engines directly (no HTTP server needed), so it
works for scripting, cron monitors and demos alike. Every listing command
supports ``--json`` for machine consumption.

    bdd init                      create dirs + database
    bdd serve [--port 8000]       start the HTTP API
    bdd seed [--reset]            load the synthetic demo corpus
    bdd ingest FILE [options]     freeze + profile + score a dataset
    bdd artifacts                 list artifacts (ids, hashes, fitness)
    bdd show ID                   manifest / profile / fitness / lineage
    bdd findings [filters]        review queue
    bdd finding ID                full finding payload
    bdd review ID --status ...    record a reviewer decision
    bdd compare A COL_A B COL_B   comparability gates + reconciliation
    bdd ask "question"            Ask Detective from the terminal
    bdd summary                   corpus + queue statistics
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from bdd_api.config import get_settings


def _bootstrap() -> None:
    """Idempotent local setup: dirs, settings, engine."""
    settings = get_settings()
    settings.ensure_dirs()
    from bdd_api.db import get_engine, init_engine

    try:
        get_engine()
    except RuntimeError:
        init_engine(str(settings.database_url))


def _reset_engine() -> None:
    from bdd_api.db import init_engine

    init_engine(str(get_settings().database_url))


def _emit(data: Any, as_json: bool) -> None:
    if as_json:
        print(json.dumps(data, indent=2, default=str))
    else:
        print(data)


def _fmt_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024  # type: ignore[assignment]
    return f"{n:.1f} TB"


# ---------- commands ----------


def cmd_init(args: argparse.Namespace) -> int:
    settings = get_settings()
    settings.ensure_dirs()
    from bdd_api.db import init_engine

    init_engine(str(settings.database_url))
    print(f"database: {settings.database_url}")
    print(f"raw store: {settings.raw_store}")
    print("ok - run `bdd seed` for the demo corpus or `bdd serve` to start the API")
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    import uvicorn

    uvicorn.run(
        "bdd_api.main:app",
        host=args.host,
        port=args.port,
        log_level="info",
    )
    return 0


def cmd_seed(args: argparse.Namespace) -> int:
    from bdd_api.seed import seed_demo

    if args.reset:
        settings = get_settings()
        db_path = settings.database_url.replace("sqlite:///", "")
        if settings.database_url.startswith("sqlite") and Path(db_path).exists():
            Path(db_path).unlink()
            for suffix in ("-wal", "-shm"):
                p = Path(db_path + suffix)
                if p.exists():
                    p.unlink()
        _reset_engine()

    result = seed_demo()
    if args.json:
        _emit(result, True)
        return 0
    print(f"seeded: {len(result['seeded'])} artifact(s)")
    for aid in result["seeded"]:
        print(f"  + {aid}")
    if result["skipped"]:
        print(f"skipped (already present): {len(result['skipped'])}")
    print(f"new findings written: {result['new_findings']}")
    return 0


def cmd_ingest(args: argparse.Namespace) -> int:
    from bdd_api.jobs import StepReporter
    from bdd_api.pipelines import run_ingest

    path = Path(args.file)
    if not path.exists():
        print(f"error: file not found: {path}", file=sys.stderr)
        return 1

    artifact_id = args.artifact_id or f"art-{path.stem.lower().replace('_', '-')}-{abs(hash(path.read_bytes())) % 99999:05d}"
    settings = get_settings()

    class EchoReporter(StepReporter):
        def __init__(self) -> None:
            super().__init__("cli")

        def start(self, name: str, detail: str | None = None) -> None:
            pass

        def done(self, name: str, detail: str | None = None) -> None:
            print(f"  ✓ {name}: {detail or ''}")

        def fail(self, name: str, detail: str) -> None:
            print(f"  ✗ {name}: {detail}", file=sys.stderr)

    try:
        result = run_ingest(
            tmp_path=path,
            original_filename=path.name,
            artifact_id=artifact_id,
            source_id=args.source_id,
            title=args.title,
            release_date=args.release_date,
            settings=settings,
            reporter=EchoReporter(),
        )
    except Exception as exc:  # noqa: BLE001 - CLI boundary
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        _emit(result, True)
        return 0
    print(
        f"ingested {artifact_id}: {result['rows']} rows x {result['columns']} cols, "
        f"fitness {result['fitness_score']:.1f} ({result['fitness_grade']}), "
        f"sha256 {result['sha256'][:16]}..."
    )
    return 0


def cmd_artifacts(args: argparse.Namespace) -> int:
    from bdd_api.db import ArtifactRow, db_session
    from sqlalchemy import select

    with db_session() as session:
        rows = session.scalars(select(ArtifactRow).order_by(ArtifactRow.created_at.desc())).all()
        items = [
            {
                "artifact_id": r.artifact_id,
                "title": r.title,
                "source_id": r.source_id,
                "sha256": r.sha256,
                "rows": (r.profile_json or {}).get("row_count"),
                "cols": (r.profile_json or {}).get("column_count"),
                "grade": (r.fitness_json or {}).get("grade"),
                "score": (r.fitness_json or {}).get("score"),
                "bytes": r.byte_size,
            }
            for r in rows
        ]
    if args.json:
        _emit(items, True)
        return 0
    if not items:
        print("no artifacts yet - `bdd ingest FILE` or `bdd seed`")
        return 0
    width = max(len(i["artifact_id"]) for i in items) + 2
    for i in items:
        grade = i["grade"] or "-"
        score = f"{i['score']:.0f}" if i["score"] is not None else "-"
        dims = f"{i['rows']}x{i['cols']}" if i["rows"] is not None else "?"
        print(f"{i['artifact_id']:<{width}} {grade:>2} ({score:>3})  {dims:>10}  {_fmt_bytes(i['bytes']):>9}  {i['title'] or ''}")
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    from bdd_api.db import ArtifactRow, FindingRow, db_session
    from bdd_contracts.anomaly import AnomalyFinding, ContradictionFinding, DriftFinding
    from bdd_contracts.artifact import ArtifactManifest
    from bdd_contracts.benford import BenfordFinding
    from bdd_contracts.consensus import ConsensusFinding
    from bdd_contracts.profile import DatasetProfile
    from bdd_forensics.lineage import build_lineage
    from sqlalchemy import select

    with db_session() as session:
        row = session.get(ArtifactRow, args.artifact_id)
        if row is None:
            print(f"error: artifact {args.artifact_id} not found", file=sys.stderr)
            return 1
        all_findings = list(session.scalars(select(FindingRow)).all())

    section = args.section
    if section in {"manifest", None}:
        _emit(row.manifest_json, True)
    if section == "profile":
        _emit(row.profile_json, True)
    if section == "fitness":
        _emit(row.fitness_json, True)
    if section == "lineage":
        manifest = ArtifactManifest.model_validate(row.manifest_json)
        profile = DatasetProfile.model_validate(row.profile_json) if row.profile_json else None
        models = {"anomaly": AnomalyFinding, "contradiction": ContradictionFinding, "drift": DriftFinding, "consensus": ConsensusFinding, "benford": BenfordFinding}
        linked = []
        for frow in all_findings:
            if args.artifact_id not in set(map(str, frow.artifact_ids or [])):
                continue
            model = models.get(frow.kind)
            if model is not None:
                linked.append(model.model_validate(frow.payload_json))
        graph = build_lineage(manifest, profile, linked)
        _emit(json.loads(graph.model_dump_json(by_alias=True)), True)
    if section is None:
        # default: compact overview of everything
        print(f"artifact: {row.artifact_id}")
        print(f"title:    {row.title or '-'}")
        print(f"sha256:   {row.sha256}")
        print(f"size:     {_fmt_bytes(row.byte_size)}  media: {row.media_type}")
        if row.release_date:
            print(f"release:  {row.release_date}")
        if row.fitness_json:
            print(f"fitness:  {row.fitness_json['score']:.1f} ({row.fitness_json['grade']})")
            for comp in row.fitness_json["components"]:
                bar = "#" * int(comp["score"] / 5)
                print(f"  {comp['name'].replace('_', ' '):<22}{bar:<22}{comp['score']:.0f}")
        if row.profile_json:
            p = row.profile_json
            print(f"shape:    {p['row_count']} rows x {p['column_count']} cols, {len(p['quality_observations'])} quality flag(s)")
            for col in p["columns"]:
                pii = ",".join(h["hint_type"] for h in col.get("pii_hints", []))
                extra = f"  [PII: {pii}]" if pii else ""
                print(f"  - {col['name']}<{col['dtype']}> nulls {(col['null_ratio'] * 100):.0f}%{extra}")
        print("\nsections: --manifest | --profile | --fitness | --lineage")
    return 0


def cmd_findings(args: argparse.Namespace) -> int:
    from bdd_api.db import FindingRow, db_session
    from sqlalchemy import select

    query = select(FindingRow).order_by(FindingRow.created_at.desc())
    if args.kind:
        query = query.where(FindingRow.kind == args.kind)
    if args.severity:
        query = query.where(FindingRow.severity == args.severity)
    if args.status:
        query = query.where(FindingRow.status == args.status)
    if args.q:
        like = f"%{args.q.lower()}%"
        from sqlalchemy import func, or_

        query = query.where(or_(func.lower(FindingRow.title).like(like), func.lower(FindingRow.summary).like(like)))
    query = query.limit(args.limit)

    with db_session() as session:
        rows = session.scalars(query).all()
        items = [
            {
                "id": r.finding_id,
                "kind": r.kind,
                "severity": r.severity,
                "confidence": r.confidence,
                "status": r.status,
                "title": r.title,
                "summary": r.summary,
                "artifacts": r.artifact_ids,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ]
    if args.json:
        _emit(items, True)
        return 0
    if not items:
        print("queue empty for these filters")
        return 0
    for i in items:
        marker = {"high": "!!", "critical": "!!", "medium": "! ", "low": ". ", "info": "  "}.get(i["severity"], "  ")
        status_tag = "" if i["status"] == "open" else f" [{i['status'].replace('_', ' ')}]"
        print(f"{marker} {i['id']}  {i['kind']:<13}{i['title']}{status_tag}")
        print(f"   {i['summary'][:140]}")
    return 0


def cmd_finding(args: argparse.Namespace) -> int:
    from bdd_api.db import FindingRow, db_session

    with db_session() as session:
        row = session.get(FindingRow, args.finding_id)
    if row is None:
        print(f"error: finding {args.finding_id} not found", file=sys.stderr)
        return 1
    _emit(row.payload_json, True)
    return 0


def cmd_review(args: argparse.Namespace) -> int:
    from datetime import UTC, datetime

    from bdd_api.db import ALLOWED_REVIEW_STATUSES, FindingRow, db_session

    if args.status not in ALLOWED_REVIEW_STATUSES:
        print(f"error: status must be one of {sorted(ALLOWED_REVIEW_STATUSES)}", file=sys.stderr)
        return 1
    with db_session() as session:
        row = session.get(FindingRow, args.finding_id)
        if row is None:
            print(f"error: finding {args.finding_id} not found", file=sys.stderr)
            return 1
        row.status = args.status
        row.reviewed_at = datetime.now(UTC)
        if args.note:
            row.reviewer_note = args.note
        session.commit()
    print(f"reviewed {args.finding_id} -> {args.status}")
    return 0


def cmd_compare(args: argparse.Namespace) -> int:
    from bdd_api.pipelines import run_compare

    try:
        result = run_compare(args.artifact_a, args.column_a, args.artifact_b, args.column_b)
    except Exception as exc:  # noqa: BLE001 - CLI boundary
        print(f"error: {exc}", file=sys.stderr)
        return 1
    if args.json:
        _emit(result, True)
        return 0
    print(f"overall: {result['overall'].replace('_', ' ').upper()}")
    for gate in result["gates"]:
        print(f"  {gate['dimension']:<11}{gate['state'].replace('_', ' '):<16}{gate['reason'][:80]}")
    for aid, t in result["totals"].items():
        print(f"total[{aid}.{t['column']}] = {t['total']:,.4g}")
    c = result["contradiction"]
    print(f"reconciliation: {c['reconciliation_status'].replace('_', ' ')} (delta {c.get('delta')})")
    for d in result["drift_findings"]:
        print(f"drift: {d['drift_type']} on '{d['concept_id']}' impact {d['semantic_impact']:.2f} -> {d['comparability_decision']}")
    print("findings persisted to the review queue")
    return 0


def cmd_ask(args: argparse.Namespace) -> int:
    from bdd_api.ask import ask as ask_service

    response = ask_service(args.question, args.artifact or None)
    if args.json:
        _emit(response, True)
        return 0
    print(f"[{response['mode']} · confidence {response['confidence']}]")
    print(response["answer"])
    if response["citations"]:
        print("\nevidence:")
        for c in response["citations"]:
            print(f"  {c['ref']}  {c['locator']}  {c['snippet'][:90]}")
    if response["suggested_next"]:
        print("\nnext: " + " | ".join(response["suggested_next"]))
    return 0


def cmd_summary(_: argparse.Namespace) -> int:
    from bdd_api.db import ArtifactRow, FindingRow, db_session
    from sqlalchemy import select

    with db_session() as session:
        artifacts = list(session.scalars(select(ArtifactRow)).all())
        findings = list(session.scalars(select(FindingRow)).all())

    by_kind: dict[str, int] = {}
    by_sev: dict[str, int] = {}
    open_n = 0
    for f in findings:
        by_kind[f.kind] = by_kind.get(f.kind, 0) + 1
        by_sev[f.severity] = by_sev.get(f.severity, 0) + 1
        if f.status == "open":
            open_n += 1
    grades = [a.fitness_json for a in artifacts if a.fitness_json]
    avg = sum(g["score"] for g in grades) / len(grades) if grades else 0.0
    rows_total = sum(int((a.profile_json or {}).get("row_count") or 0) for a in artifacts)

    print("Bharat Data Detective - corpus summary")
    print(f"  artifacts:      {len(artifacts)}  ({rows_total:,} rows, {_fmt_bytes(sum(a.byte_size for a in artifacts))})")
    print(f"  avg fitness:    {avg:.1f}")
    print(f"  findings:       {len(findings)}  (open reviews: {open_n})")
    for kind, n in sorted(by_kind.items()):
        print(f"    {kind:<14}{n}")
    sev_line = "  ".join(f"{k}:{n}" for k, n in sorted(by_sev.items()))
    print(f"  severity mix:   {sev_line or '-'}")
    return 0


# ---------- blind benchmark evaluation (restricted governance) ----------


def _eval_ready() -> None:
    try:
        import bdd_evaluation  # noqa: F401
    except Exception as exc:
        print(f"error: evaluation package unavailable: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


def cmd_eval_run(args: argparse.Namespace) -> int:
    _eval_ready()
    from bdd_evaluation.blind import run_blind

    result = run_blind()
    if args.json:
        _emit(result, True)
        return 0
    print(f"blind run {result['run_id']} written to {result['path']}")
    print(f"  cases evaluated: {result['cases']}  input_hash {result['input_hash']}")
    print("labels were NOT read; reveal happens only at adjudication")
    return 0


def cmd_eval_adjudicate(args: argparse.Namespace) -> int:
    _eval_ready()
    from bdd_evaluation.adjudicate import adjudicate

    try:
        result = adjudicate(
            run_id=args.run_id,
            case_id=args.case,
            decision=args.decision,
            matched_finding_ids=[s for chunk in (args.findings or []) for s in chunk.split(",") if s],
            note=args.note or "",
            adjudicator=args.adjudicator,
        )
    except (KeyError, ValueError, FileNotFoundError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    if args.json:
        _emit(result, True)
        return 0
    print(f"adjudicated {result['case']}: {result['decision']}")
    print(f"ledger: {result['ledger']}")
    return 0


def cmd_eval_report(args: argparse.Namespace) -> int:
    _eval_ready()
    from bdd_evaluation.adjudicate import report

    try:
        metrics = report(args.run_id)
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    if args.json:
        _emit(metrics, True)
        return 0
    print(f"evaluation report - {metrics['run_id']} (inputs {metrics['input_hash']})")
    print(f"  cases total:              {metrics['cases_total']}")
    print(f"  mapped to public data:    {metrics['cases_mapped_to_public_artifacts']}  (coverage {metrics['coverage_ratio']})")
    print(f"  adjudicated:              {metrics['cases_adjudicated']}")
    for decision, n in metrics["decisions"].items():
        print(f"    {decision:<22}{n}")
    rate = metrics["detectability_rate"]
    print(f"  detectability rate:       {rate if rate is not None else 'null (no denominator yet)'}")
    print(f"  evidence completeness:    {metrics['evidence_completeness']}")
    if metrics["unmapped_cases"]:
        print(f"  access gaps documented:   {', '.join(metrics['unmapped_cases'])}")
    if metrics["pending_adjudication"]:
        print(f"  pending adjudication:     {', '.join(metrics['pending_adjudication'])}")
    return 0


# ---------- parser ----------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="bdd",
        description="Bharat Data Detective - AI forensic & evidence-trust layer for Indian public data",
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("init", help="create directories + database").set_defaults(func=cmd_init)

    p_serve = sub.add_parser("serve", help="start the HTTP API")
    p_serve.add_argument("--host", default="127.0.0.1")
    p_serve.add_argument("--port", type=int, default=8000)
    p_serve.set_defaults(func=cmd_serve)

    p_seed = sub.add_parser("seed", help="load the synthetic demo corpus")
    p_seed.add_argument("--reset", action="store_true", help="wipe the local database first")
    p_seed.add_argument("--json", action="store_true")
    p_seed.set_defaults(func=cmd_seed)

    p_ing = sub.add_parser("ingest", help="freeze + profile + score a dataset file")
    p_ing.add_argument("file")
    p_ing.add_argument("--artifact-id", help="defaults to a deterministic id from the filename")
    p_ing.add_argument("--source-id", required=True, help="stable source id, e.g. SRC-MGN-01")
    p_ing.add_argument("--title")
    p_ing.add_argument("--release-date", help='period label e.g. "FY 2024-25"')
    p_ing.add_argument("--json", action="store_true")
    p_ing.set_defaults(func=cmd_ingest)

    p_arts = sub.add_parser("artifacts", help="list ingested artifacts", aliases=["ls"])
    p_arts.add_argument("--json", action="store_true")
    p_arts.set_defaults(func=cmd_artifacts)

    p_show = sub.add_parser("show", help="inspect an artifact")
    p_show.add_argument("artifact_id")
    p_show.add_argument("--manifest", dest="section", action="store_const", const="manifest")
    p_show.add_argument("--profile", dest="section", action="store_const", const="profile")
    p_show.add_argument("--fitness", dest="section", action="store_const", const="fitness")
    p_show.add_argument("--lineage", dest="section", action="store_const", const="lineage")
    p_show.set_defaults(func=cmd_show, section=None)

    p_find = sub.add_parser("findings", help="review queue")
    p_find.add_argument("--kind", choices=["anomaly", "contradiction", "drift", "consensus", "benford"])
    p_find.add_argument("--severity", choices=["critical", "high", "medium", "low", "info"])
    p_find.add_argument("--status", default="open", help="default: open; pass 'all' to disable")
    p_find.add_argument("-q", "--query", dest="q")
    p_find.add_argument("--limit", type=int, default=50)
    p_find.add_argument("--json", action="store_true")
    p_find.set_defaults(func=cmd_findings)

    p_one = sub.add_parser("finding", help="full payload of one finding")
    p_one.add_argument("finding_id")
    p_one.set_defaults(func=cmd_finding)

    p_rev = sub.add_parser("review", help="record a reviewer decision")
    p_rev.add_argument("finding_id")
    p_rev.add_argument(
        "--status",
        required=True,
        choices=["open", "needs_source_clarification", "resolved", "not_detectable", "false_positive_after_review"],
    )
    p_rev.add_argument("--note")
    p_rev.set_defaults(func=cmd_review)

    p_cmp = sub.add_parser("compare", help="gate + reconcile two artifacts")
    p_cmp.add_argument("artifact_a")
    p_cmp.add_argument("column_a")
    p_cmp.add_argument("artifact_b")
    p_cmp.add_argument("column_b")
    p_cmp.add_argument("--json", action="store_true")
    p_cmp.set_defaults(func=cmd_compare)

    p_ask = sub.add_parser("ask", help="Ask Detective from the terminal")
    p_ask.add_argument("question")
    p_ask.add_argument("--artifact", action="append", help="restrict evidence scope (repeatable)")
    p_ask.add_argument("--json", action="store_true")
    p_ask.set_defaults(func=cmd_ask)

    sub.add_parser("summary", help="corpus + queue statistics").set_defaults(func=cmd_summary)

    # ---- blind benchmark evaluation (restricted) ----
    p_eval = sub.add_parser("eval", help="blind benchmark evaluation (restricted)")
    eval_sub = p_eval.add_subparsers(dest="eval_command", required=True)

    p_run = eval_sub.add_parser("run", help="execute one blinded pass over the case registry")
    p_run.add_argument("--json", action="store_true")
    p_run.set_defaults(func=cmd_eval_run)

    p_adj = eval_sub.add_parser("adjudicate", help="record a human decision for one case")
    p_adj.add_argument("run_id")
    p_adj.add_argument("case")
    p_adj.add_argument("--decision", required=True, choices=["detected", "partially_detected", "not_detected", "not_detectable"])
    p_adj.add_argument("--findings", action="append", help="matched finding id(s), comma-separated, repeatable")
    p_adj.add_argument("--note")
    p_adj.add_argument("--adjudicator", default="cli")
    p_adj.add_argument("--json", action="store_true")
    p_adj.set_defaults(func=cmd_eval_adjudicate)

    p_rep = eval_sub.add_parser("report", help="metrics with explicit denominators")
    p_rep.add_argument("run_id")
    p_rep.add_argument("--json", action="store_true")
    p_rep.set_defaults(func=cmd_eval_report)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        return 0
    if args.command != "serve":
        _bootstrap()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
