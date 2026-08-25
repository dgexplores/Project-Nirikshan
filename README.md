# Bharat Data Detective (BDD)

AI forensic and evidence-trust layer for Indian public data.

BDD ingests public datasets, freezes them immutably with SHA-256 manifests,
profiles their structure and quality, resolves what fields *mean* (units,
denominators, definitions), compares evidence across sources and time, and
produces reviewable case files. Output is **not a truth verdict**: it is an
evidence-backed finding with source lineage, reproducible checks, calibrated
uncertainty, and a recommended verification action.

**Core principle:** BDD identifies evidence-backed potential inconsistencies
for review. It does not declare a source, a dataset, or a person "wrong."

---

## Quickstart

Requirements: [uv](https://docs.astral.sh/uv/) (Python >= 3.12) for the API,
Node >= 20 for the dashboard. Docker optional.

### One command each (local dev)

```bash
# Terminal 1 — API on :8000 (SQLite, zero external services)
uv sync
uv run uvicorn bdd_api.main:app --port 8000

# Terminal 2 — Dashboard on :3000 (proxies /api/backend -> :8000)
cd apps/web && npm install && npm run dev
```

Then open http://localhost:3000 and click **Load demo case** to seed a full
synthetic forensic corpus (drift + anomaly + contradiction + false-consensus
demos) in one click.

### Full stack via Docker

```bash
docker compose -f infra/docker/compose.yml up --build
# web: http://localhost:3000   api: http://localhost:8000/docs   db: Postgres+PostGIS
```

### Verify

```bash
uv run pytest        # 100+ tests incl. API lifecycle, engines, leakage guard
uv run ruff check .  # lint
cd apps/web && npm run build  # typecheck + production build
curl -X POST localhost:8000/seed/demo   # deterministic synthetic corpus
```

---

## What the product does

| Surface | What you get |
|---|---|
| **Dashboard** | Corpus stats, findings by severity/engine, review backlog, animated overview |
| **Datasets** | Drag-drop ingest with live step-by-step job progress; SHA-256 manifest, column profiler (nulls/distributions/candidate keys), PII hints, quality observations, data-fitness score (A–F), evidence lineage graph |
| **Findings queue** | Unified anomalies, contradictions, semantic drift and consensus findings; severity/confidence/status filters; one-click reviewer decisions with audit notes |
| **Compare** | Comparability gates (geography · period · unit · definition) before any numeric reconciliation; drift detection between releases; neither side is ever labelled "wrong" |
| **Ask Detective** | Question answering restricted to frozen evidence; every claim carries an [E#] citation chip; refuses when evidence is insufficient; optional LLM synthesis with hard safety gating |

## Signature innovations

1. **Semantic Drift Detection** - versions definitions, units, denominators
   and boundaries; a numerical change is not comparable until the concept
   behind it is checked. Drift scored by semantic impact, not string diff.
2. **Evidence Lineage Graph** - every displayed claim traces back through
   parser → profile → rule → raw evidence, rendered as a graph per artifact.
3. **False Consensus Detection** - several pages repeating a number are not
   independent confirmation if they trace to the same origin. BDD reports
   evidence diversity, not raw source count.
4. **Cross-source AI Forensics** - staged comparison: deterministic alignment
   gates first, then numeric reconciliation; LLM only ever summarizes bounded,
   cited excerpts and never calculates facts or picks a "true" source.

## Engineering guarantees

- **Deterministic findings**: identical inputs → identical finding ids
  (hash-derived); reruns are idempotent.
- **Immutable artifacts**: freeze-without-overwrite raw store; manifests pin
  parser version + config hash.
- **Robust API surface**: consistent `{error:{code,message,request_id}}`
  envelope, request-id middleware, structured JSON logs, upload size/format
  guards, gzip, CORS allow-list, graceful job failure surfacing step-by-step.
- **Persistence**: SQLAlchemy dual-mode - SQLite out of the box,
  `BDD_DATABASE_URL=postgresql+psycopg://…` for production (compose ships Postgres).
- **Governance**: reviewer decisions are first-class rows; benchmark labels are
  quarantined in `data/benchmark-restricted/` and a CI leakage test fails any
  label string that reaches app code or fixtures.
- **CI**: ruff + pytest + docker image builds on every PR.

## Configuration

All knobs are `BDD_`-prefixed env vars (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `BDD_DATABASE_URL` | `sqlite:///data/bdd.db` | SQLite or Postgres (`postgresql+psycopg://`) |
| `BDD_RAW_STORE` / `BDD_MANIFEST_DIR` | `data/raw` / `data/manifests` | Immutable stores |
| `BDD_MAX_UPLOAD_MB` | `200` | Ingest size guard |
| `BDD_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated origins |
| `BDD_LLM_BASE_URL` / `BDD_LLM_API_KEY` / `BDD_LLM_MODEL` | empty | Optional OpenAI-compatible endpoint for Ask Detective synthesis |

Ask Detective runs fully offline in deterministic cited-synthesis mode when no
LLM is configured.

## Repository layout

```
apps/web/                  # Next.js 15 + TS + Tailwind + framer-motion dashboard
services/api/              # FastAPI: routers, jobs, pipelines, ask service, seed
packages/contracts/        # shared Pydantic v2 schemas (manifests, findings, lineage…)
pipelines/ingestion/       # parsers (CSV/TSV/XLSX/JSON/JSONL/Parquet), manifests, CLI
pipelines/forensics/       # profiler, normalize, drift, anomaly, comparability,
                           # cross-source, fitness, lineage, false-consensus, definitions
pipelines/evaluation/      # blind benchmark runner (restricted)
graph/, rag/               # reserved adapters (see docs/specification)
data/fixtures/public/      # synthetic demo fixtures generated by seed
data/benchmark-restricted/ # CAG case registry (isolated, never loaded at runtime)
docs/                      # specification, ADRs, benchmark protocol
infra/docker/              # Dockerfiles + compose (api, web, postgres)
tests/                     # unit + API lifecycle + seed + leakage guard
```

## The demo case (synthetic, reproducible)

`POST /seed/demo` writes five byte-stable CSV fixtures and runs the full stack:

1. Two micro-irrigation annual releases reporting beneficiaries in **lakh**
   then **crore** → unit/definition/scope **semantic drift**, gated
   `not_comparable`.
2. A district irrigation table with a planted reporting spike → **anomaly**
   findings (IQR).
3. Two "sources" quoting one scheme total, where the digest derives from the
   release → **cross-source conflict** plus a **false-consensus** finding
   (diversity ratio 0.5).

Everything above is marked synthetic in source ids/titles. No real-world
accusations; no benchmark labels.

## Validation strategy

BDD is evaluated against independently verified historical findings from CAG
reports used as a **hidden benchmark** (register → map → freeze → blind run →
adjudicate → measure). See `docs/benchmark-protocol.md`. A "not detectable"
outcome is a finding, not a failure: it documents a data-access or
observability gap. No performance claims until measured.

## Governance rules (mandatory)

- No raw source replacement: add a versioned artifact + supersession link.
- Benchmark labels never enter app seed data, retrieval index, prompts or logs
  (enforced by `tests/test_leakage.py`).
- Every displayed finding carries at least one evidence link and one
  provenance record; high/critical findings need human confirmation before
  external sharing.
- Secrets never committed; `.env.example` placeholders only.

## Documents

- `docs/specification/*.docx` - implementation blueprint + deliverables pack
- `docs/benchmark-protocol.md` - blinded CAG evaluation protocol
- `docs/adr/ADR-0001-repository-layout.md`

## Status

Launch-ready v1.0: ingestion, profiling, fitness scoring, semantic engines,
lineage graph, false-consensus detection, persisted multi-mode storage,
background jobs, full forensic dashboard, Ask Detective (LLM optional),
synthetic demo corpus, CI with docker builds + leakage guard.

---

## Roadmap

### Done (v1.0)

- [x] Immutable ingestion: SHA-256 freeze store, parser-version pinning, manifests
- [x] Column profiler: nulls/distributions/candidate keys/duplicates + PII hints (Aadhaar, PAN, mobile…)
- [x] Data fitness score (A–F) with weighted component breakdown
- [x] Semantic engines: unit/fiscal-year normalization, definition cards,
      drift detection (definition/unit/denominator/scope) scored by semantic impact
- [x] Comparability gates (geography/temporal/unit/definition) before any reconciliation
- [x] Cross-source contradiction engine (`conflict` / `explainable` / `not_comparable`)
- [x] False-consensus detection via evidence-diversity ratio
- [x] Evidence lineage graph per artifact (raw → parser → profile → rule → finding)
- [x] Persistence: SQLAlchemy dual-mode (SQLite default / Postgres), idempotent hash-keyed findings
- [x] Background jobs with persisted step-level progress
- [x] Web dashboard: ingest w/ live job steps, profiler views, findings queue +
      reviewer decisions, compare workbench, lineage visualization
- [x] Ask Detective: deterministic cited synthesis; optional LLM with hard safety gate
- [x] Synthetic demo corpus (one-click seed) + CI incl. docker builds and benchmark-leakage guard

### In progress — Tier 1: smarter engines

- [ ] **Benford's law analysis** — first-digit distribution test for fabricated /
      manipulated numeric columns (classic forensic-accounting signal)
- [ ] **Fuzzy entity resolution** — RapidFuzz matching for village/district name
      variants ("Adabari" vs "Adabari T.E.") feeding the geography comparability gate
- [ ] **Seasonal/trend-aware anomaly baseline** — expected value from rolling median
      or STL residual instead of flat mean, cutting false positives on cyclical data

### Next — Tier 2: real RAG + agent (spec Sprint 4)

- [ ] Qdrant + embeddings over chunked dataset content and scheme documents
      (compose already ships Qdrant)
- [ ] PDF/document ingestion so drift checks cover policy text, not just tables
- [ ] LangGraph investigation flow per spec §15: scope_guard → retrieve_evidence
      → assess_sufficiency → refuse_or_plan → deterministic_tools → cited_memo
      → claim_safety_check
- [ ] Hindi/Hinglish question understanding (India-first requirement)

### Next — Tier 3: production hardening

- [ ] JWT auth + RBAC (reviewer/admin roles for the human-review gate)
- [ ] Durable job queue (Arq/Celery + Redis) surviving restarts, with retries
- [ ] S3/MinIO object store for raw artifacts + presigned uploads
- [ ] Alembic versioned migrations replacing create_all
- [ ] OpenTelemetry traces + Prometheus metrics (spec NFR)
- [ ] DuckDB query engine for 10 GB+ files

### Later — Tier 4: product moat

- [ ] Scheduled source monitors: re-fetch registered URLs on a cron, alert when a
      portal silently revises published numbers
- [ ] One-click case-file export (PDF: findings + lineage + reviewer sign-off)
- [ ] Blind benchmark runner UI (`pipelines/evaluation`) producing measured
      precision/recall against the CAG registry
- [ ] Public API keys for embedding BDD checks into other pipelines

> Rule that governs all of the above: no accuracy claims until the blinded CAG
> benchmark produces measured numbers.

## License

MIT (c) 2026 Deepak Gangwar
