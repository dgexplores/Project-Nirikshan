# Bharat Data Detective (BDD)

**AI forensic and evidence-trust layer for Indian public data.** Flags inconsistencies for human review, never declares anyone "wrong".

> Built for **UNLEASH LLM, Responsible AI, Rooted in India** (India-First Dataset Track via AIKosh)

---

## Live demo

| Layer | Link | What to test |
|---|---|---|
| **Frontend (Next.js)** | **https://web-tau-sandy-60.vercel.app** | Dashboard → Datasets (drag-drop) → Findings → Ask Detective |
| **Backend API (FastAPI)** | **https://bharat-api-production.up.railway.app** | Health, seed, ask |
| **API Docs (Swagger)** | **https://bharat-api-production.up.railway.app/docs** | Try all endpoints live |
| **GitHub (Direct Use)** | **https://github.com/dgexplores/bharat-data-detective** | Clone and run locally, see below |

### Direct GitHub use

**Clone & run locally (2 commands):**
```bash
git clone https://github.com/dgexplores/bharat-data-detective.git
cd bharat-data-detective && docker compose -f infra/docker/compose.yml up --build
# → Frontend: http://localhost:3000  Backend: http://localhost:8000/docs
```

**Use in browser (no install):**
- **Frontend:** https://web-tau-sandy-60.vercel.app
- **Backend:** https://bharat-api-production.up.railway.app/docs

**Open in GitHub Codespaces (one click, free):**
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=dgexplores/bharat-data-detective)

**Deploy your own free copy:**
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/dgexplores/bharat-data-detective&project-name=bharat-data-detective&root-directory=apps/web) [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/github/dgexplores/bharat-data-detective)

**Quick test (copy-paste in terminal):**
```bash
curl https://bharat-api-production.up.railway.app/health
# {"status":"ok","service":"bdd-api","version":"1.0.0"}

curl -X POST https://bharat-api-production.up.railway.app/seed/demo -H 'Content-Length: 0'
# seeds 6 demo datasets → 20 findings

curl -X POST https://bharat-api-production.up.railway.app/ask \
 -H 'Content-Type: application/json' \
 -d '{"question":"Bareilly beneficiaries lakh"}' | jq .answer
# → cited answer with [E1] [E2]...
```

---

## By the numbers

These are live, checkable facts, not marketing claims. Every figure below is either a running test count, a live API response, or a number sitting in the repo right now.

| | |
|---|---|
| Forensic engines | 5 (drift, anomaly, contradiction, false consensus, Benford) |
| Real government datasets ingested | 3, from data.gov.in and nrega.nic.in |
| Real findings from real data, live right now | 50 (34 anomaly, 16 Benford) |
| Backend tests passing | 152, zero failures |
| Strongest real finding | SAS Nagar (Mohali) district's school enrollment ratio hits 145% of capacity by 2022, z-score 3.78 against its peers |
| Languages Ask Detective answers in | Hindi and English, both cited |

---

## What this is

Government portals in India publish enormous amounts of data on farmers, crops, schools, pensions. Nobody has time to check it by hand, so most of it goes unchecked. The same scheme sometimes shows different totals on two different pages. A unit quietly switches from lakh to crore between one year's release and the next. Ten articles repeat one number, and it looks like ten confirmations when it's really one source copied nine times.

BDD reads a dataset the way a careful analyst would, and it never pretends to know more than the data supports.

1. You upload any CSV or Excel file, or point it at a real dataset from data.gov.in / AIKosh.
2. It freezes the file with a SHA-256 hash so it can never be silently changed later, checks its quality, and works out what each column actually means (in Hindi and English: lakh/लाख, crore/करोड़, FY 2024-25).
3. Five checks run against it: has the **definition drifted**? Is there an **anomaly**? Do **two sources contradict** each other? Is this **false consensus** (many "sources," one origin)? Do the digits fail a **Benford** check?
4. Every flag comes with the evidence, the exact source row, and a lineage graph back to the original bytes. You decide what it means, the tool never does.

> Core rule: evidence before narrative. The LLM is a sidekick here, never the judge.

---

## Features

**For anyone:**
- **Drag-drop ingest**, CSV/TSV/XLSX/JSON/Parquet, live progress, fitness grade A-F
- **Auto profile**, nulls, duplicates, distributions, PII hints (Aadhaar/PAN/mobile flagged)
- **Lineage graph**, click any finding to see raw file to parser to rule to finding (animated SVG)
- **Findings queue**, filter by severity/engine, one-click reviewer decision (resolved / false-positive)

**For analysts:**
- **Compare any two datasets**, gates check geography/period/unit/definition before numbers are compared (lakh vs crore is blocked, not silently compared)
- **Benford screening**, digit pattern vs natural law (MAD score) to spot fabricated-looking amounts
- **False consensus**, 2 "sources" tracing to 1 origin is reported as diversity 0.5, not 2 confirmations
- **Fuzzy geo match**, "Adabari T.E." matches "Adabari" (RapidFuzz) so spelling doesn't block valid compares

**For AI and India-first work:**
- **Ask Detective**, ask in Hindi or English ("बरेली में कितने लाभार्थी?"), get a cited answer `[E1]` or an honest refusal if evidence is thin
- **Responsible AI in practice**: PII redacted before any LLM call, prompt-injection blocked, hallucination flagged, every label access logged
- **India datasets ready**: real GER, MGNREGA, and Kisan Call Centre data from data.gov.in (see Real data proof below), plus Pincode Directory and Crop Production demo fixtures, all frozen with manifests

**For developers:**
- **`bdd` CLI**, `bdd seed`, `bdd ingest`, `bdd findings`, `bdd compare`, `bdd ask`, `bdd summary`, all `--json` scriptable
- **`bdd eval`**, blind benchmark runner: run without labels, adjudicate, report with explicit denominators (no fake accuracy)

---

## What BDD can do today

**You can use it right now for real work:**

| Capability | What happens | Try it |
|---|---|---|
| **Upload any Indian dataset** | Drag-drop CSV/Excel/JSON → frozen with SHA256 hash, never lost | `Datasets` page or `bdd ingest` |
| **Auto-check quality** | Shows nulls, duplicates, PII (Aadhaar/PAN), fitness grade A-F | Open any dataset → `Profile` tab |
| **Catch 5 forensic patterns** | Drift (lakh→crore), spike (5k vs 1k), contradiction (2 sources differ), false consensus (1 source copied), Benford digit check | `Findings` queue |
| **See proof for every flag** | Click finding → evidence row + lineage graph `raw → parser → rule → finding` | `Findings → View lineage` |
| **Compare 2 datasets safely** | Checks geography/period/unit *before* comparing numbers (blocks bad compares) | `Compare` page |
| **Ask in Hindi/English** | `बरेली में कितने लाभार्थी?` → cited answer `[E1]` or honest refusal | `Ask Detective` or `bdd ask` |
| **Work offline or with AI** | Deterministic cited answers always; add Sarvam/BharatGen key to get LLM hypotheses (still cited) | `POST /ask` |
| **Script everything** | `bdd` CLI + API + blind benchmark runner (`bdd eval`) with explicit denominators | `bdd summary`, `bdd eval run` |
| **Deploy free** | SQLite locally or Postgres on Railway free tier, frontend on Vercel free | `docker compose up` |

**Live proof:** click "Load demo case" on the deployed frontend and it seeds 6 clearly-labelled synthetic datasets (micro-irrigation unit drift, a planted district spike, two conflicting PM-KISAN-style totals, and a fabricated-looking payments file) → 20 findings, one of each engine, in under a second. Open https://web-tau-sandy-60.vercel.app and click `Findings`.

**Real government data, not just synthetic fixtures, with a real finding in it:**
The raw files for all three datasets below, along with full source-URL and SHA-256 provenance for every one, are committed in [`data/real-samples/`](data/real-samples/) and [`data/source-register.csv`](data/source-register.csv), not just described here.

- **District-wise Gross Enrollment Ratio (GER) in Schools, Punjab, 2019-2022**, downloaded directly from **data.gov.in** ([catalog page](https://www.data.gov.in/catalog/district-wise-gross-enrollment-ratio-ger-schools-punjab)), all 8 official resources (Primary/Upper Primary/Secondary/Higher Secondary x Boys/Girls), each ingested and profiled with its own resource-id provenance. The anomaly engine surfaced a genuine, consistent pattern: **SAS Nagar (Mohali) district's GER climbs to 124-145% by 2022, far above every peer district, z-score 3.78, high confidence, and it shows up across almost every school level and gender**, not a one-off glitch in a single column. This is BDD flagging something worth checking in the exact platform this track is built around, not a synthetic demo.

  The raw numbers, straight from the source file, for SAS Nagar's enrollment ratio in Primary schools:

  | Year | Boys | Girls |
  |---|---|---|
  | 2019 | 105.5 | 112.1 |
  | 2020 | 114.8 | 124.4 |
  | 2021 | 118.5 | 128.5 |
  | 2022 | **143.2** | **145.1** |

  A four-year climb, not a single bad row, which is exactly why it's worth a human looking at it: likely Mohali's rapid in-migration outpacing how its official school-age population gets updated, not necessarily anything wrong.
- **MGNREGA Punjab district-wise FY2024-25** (6,784 rows, sourced from the official [nrega.nic.in](https://nrega.nic.in) release via a public GitHub mirror) has been ingested end-to-end, profiled, scored, and run through the anomaly engine, with real findings visible in the `Findings` queue after `bdd ingest`.
- **Kisan Call Centre farmer queries, Punjab** (5,000-row real sample pulled directly from data.gov.in's own Open Government Data API, out of a live 47.9-million-row dataset) has also been ingested and profiled (fitness 98.9, grade A). It correctly produces **zero** anomaly findings, because it has no numeric metric column to check, only a call id and a calendar day/month, and forcing a statistical check on those would be a fabricated finding, not a real one. Pulling this dataset in is what surfaced and fixed a real bug: the engines used to treat any numeric column as a metric, so they confidently flagged the call ids and calendar days as "anomalies" until this was caught and corrected. The rule now lives once, as `ColumnProfile.is_metric` in `packages/contracts/src/bdd_contracts/profile.py`, and the anomaly engine, the fitness score and the definition-card inference all share it. It had been fixed in the anomaly engine alone at first, which left the same false positives in three more places: `fitness.py` (an id column's zero variance dragged down the data-quality score), `definitions.py` (a unit and denominator were invented for a call id), and the Compare page in the web app, which re-implemented the rule in TypeScript and so still offered call ids and calendar parts as comparable metrics. `is_metric` is now a serialised computed field, so the browser reads the same rule the backend applies instead of deriving its own.

All of the above is already ingested and live on the deployed demo, not just local. Reproduce any of it yourself with the `bdd` CLI, see [`data/real-samples/README.md`](data/real-samples/README.md) for the exact commands.

---

## Honest gaps, what isn't built yet

**These are real limitations today, the roadmap below tracks how we fix them:**

| Gap | Why it matters | How to make it better | Track |
|---|---|---|---|
| **No seasonal baseline** | Flat mean flags normal seasonal spikes as anomalies | Rolling median / STL residual | Tier 1 remainder |
| **No PDF/document drift** | Only tables checked, not scheme PDFs/policy text | PDF ingestion + Qdrant embeddings | Tier 2 |
| **No deep RAG agent** | Retrieval is TF-IDF, not vector search; no LangGraph flow | Qdrant + embeddings + `scope_guard → retrieve → cited_memo → safety_check` | Tier 2 |
| **Hindi is a keyword bridge, not full NLU** | Devanagari questions retrieve evidence via a curated Hindi-to-English domain-word map, not machine translation, so wording outside that map won't match | Live Bhashini/Sarvam Translate API | Tier 2 |
| **No login / roles** | Anyone can review; no reviewer vs admin | JWT auth + RBAC | Tier 3 |
| **Jobs die on restart** | Thread-pool jobs, no retry | Arq/Celery + Redis | Tier 3 |
| **No cloud storage** | Raw files on local disk | S3/MinIO + presigned uploads | Tier 3 |
| **No DB migrations** | `create_all` on startup | Alembic versioned migrations | Tier 3 |
| **No auto-monitor** | Must re-upload when portal updates | Cron re-fetch + alert on silent revisions | Tier 4 |
| **No PDF case export** | Can't share case file externally | One-click PDF (findings + lineage + sign-off) | Tier 4 |

> **No fake accuracy:** we report no precision/recall until the blind CAG benchmark is run via `bdd eval`. Transparency over hype, see `docs/benchmark-protocol.md`.

---

## How it works

```mermaid
flowchart LR
    A["Your file<br/>CSV / Excel / JSON"] --> B["Freeze<br/>SHA-256 hash"]
    B --> C["Profile<br/>nulls, PII, quality"]
    C --> D{"5 forensic engines"}
    D --> D1["Drift"]
    D --> D2["Anomaly"]
    D --> D3["Contradiction"]
    D --> D4["False consensus"]
    D --> D5["Benford"]
    D1 --> E["Findings queue"]
    D2 --> E
    D3 --> E
    D4 --> E
    D5 --> E
    E --> F["You review<br/>resolved / not detectable / false positive"]
    C -.-> G["Ask Detective<br/>retrieval + cited LLM answer"]
    G -.-> E
```

**Deterministic:** same bytes always produce the same hashes and the same findings, reruns are idempotent and regression-tested.  
**Immutable:** the raw store is never overwritten, every manifest pins the parser version and config hash used.  
**Governed:** benchmark labels in `data/benchmark-restricted/` are never indexed, a CI leakage test fails the build if they ever leak.

---

## Quickstart

Requirements: [uv](https://docs.astral.sh/uv/) (Python >= 3.12), Node >= 20, Docker optional.

### One command each (local dev)

```bash
# Terminal 1: API on :8000 (SQLite, zero external services)
uv sync
uv run uvicorn bdd_api.main:app --app-dir services/api/src --port 8000

# Terminal 2: Dashboard on :3000 (proxies /api/backend -> :8000)
cd apps/web && npm install && npm run dev
```

Then open http://localhost:3000 and click **Load demo case** to seed a full synthetic forensic corpus (drift + anomaly + contradiction + false-consensus + Benford demos) in one click.

### Full stack via Docker

```bash
docker compose -f infra/docker/compose.yml up --build
# web: http://localhost:3000   api: http://localhost:8000/docs   db: Postgres+PostGIS
```

### Permanent free-tier deploy (1-click)

**Render (backend+DB+frontend, free):** `render.yaml` blueprint → https://dashboard.render.com/blueprint → select repo → Apply  
**Vercel (frontend, free Hobby):** `cd apps/web && vercel --prod --yes` (already live at https://web-tau-sandy-60.vercel.app)  
**Supabase (DB, free 500MB):** `supabase projects create bharat-db --region ap-south-1`

No paid APIs needed (`LLM_PROVIDER=mock` deterministic, TF-IDF fallback if Qdrant not set).

### Verify

```bash
uv run pytest        # 155 tests incl. API lifecycle, engines, CLI, leakage guard
uv run ruff check .  # lint
cd apps/web && npm run build  # typecheck + production build
```

---

## Command line

Everything is scriptable via the `bdd` command (installed by `uv sync`):

```bash
uv run bdd init                          # create dirs + database
uv run bdd seed --reset                  # fresh synthetic demo corpus
uv run bdd serve --port 8000             # start the HTTP API

uv run bdd ingest data.csv --source-id SRC-MGN-01 --release-date "FY 2024-25"
uv run bdd artifacts                     # ids, hashes, fitness grades
uv run bdd show art-demo-benford         # overview (or --manifest/--profile/--fitness/--lineage)

uv run bdd findings                      # open review queue (default)
uv run bdd findings --kind benford --severity high
uv run bdd finding <id>                  # full JSON payload
uv run bdd review <id> --status resolved --note "verified against origin"

uv run bdd compare art-a beneficiaries_lakh art-b beneficiaries_crore
uv run bdd ask "any outliers in tube wells?" --artifact art-demo-irr-anomaly
uv run bdd summary                       # corpus + queue statistics

# Blind benchmark (restricted, governed)
uv run bdd eval run
uv run bdd eval adjudicate <run_id> <case> --decision detected --findings <id>
uv run bdd eval report <run_id>
```

Every list command accepts `--json` for scripting/cron use.

---

## Signature innovations

1. **Semantic Drift Detection** - versions definitions, units, denominators and boundaries; a numerical change is not comparable until the concept behind it is checked. Drift scored by semantic impact, not string diff.
2. **Evidence Lineage Graph** - every displayed claim traces back through parser → profile → rule → raw evidence, rendered as a graph per artifact.
3. **False Consensus Detection** - several pages repeating a number are not independent confirmation if they trace to the same origin. BDD reports evidence diversity, not raw source count.
4. **Cross-source AI Forensics** - staged comparison: deterministic alignment gates first, then numeric reconciliation; LLM only ever summarizes bounded, cited excerpts and never calculates facts or picks a "true" source.

---

## Engineering guarantees

- **Deterministic findings**: identical inputs → identical finding ids (hash-derived); reruns are idempotent.
- **Immutable artifacts**: freeze-without-overwrite raw store; manifests pin parser version + config hash.
- **Robust API surface**: consistent `{error:{code,message,request_id}}` envelope, request-id middleware, structured JSON logs, upload size/format guards, gzip, CORS allow-list, graceful job failure surfacing step-by-step.
- **Persistence**: SQLAlchemy dual-mode - SQLite out of the box, `BDD_DATABASE_URL=postgresql+psycopg://…` for production (compose ships Postgres).
- **Governance**: reviewer decisions are first-class rows; benchmark labels are quarantined in `data/benchmark-restricted/` and a CI leakage test fails any label string that reaches app code or fixtures.
- **CI**: ruff + pytest (SQLite + Postgres) + docker image builds on every PR.

---

## Configuration

All knobs are `BDD_`-prefixed env vars (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `BDD_DATABASE_URL` | `sqlite:///data/bdd.db` | SQLite or Postgres (`postgresql+psycopg://`) |
| `BDD_RAW_STORE` / `BDD_MANIFEST_DIR` | `data/raw` / `data/manifests` | Immutable stores |
| `BDD_MAX_UPLOAD_MB` | `200` | Ingest size guard |
| `BDD_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated origins |
| `BDD_LLM_BASE_URL` / `BDD_LLM_API_KEY` / `BDD_LLM_MODEL` | empty | Optional OpenAI-compatible endpoint for Ask Detective synthesis |

Ask Detective runs fully offline in deterministic cited-synthesis mode when no LLM is configured. It has also been verified end-to-end against a local open-source model (Ollama running `qwen2.5:3b`, `BDD_LLM_BASE_URL=http://localhost:11434/v1`), answering both English and Hindi questions with citations intact and refusing when evidence is thin.

---

## Repository layout

```
apps/web/                  # Next.js 15 + TS + Tailwind + framer-motion dashboard
services/api/              # FastAPI: routers, jobs, pipelines, ask service, seed
packages/contracts/        # shared Pydantic v2 schemas (manifests, findings, lineage…)
pipelines/ingestion/       # parsers (CSV/TSV/XLSX/JSON/JSONL/Parquet), manifests, CLI
pipelines/forensics/       # profiler, normalize, drift, anomaly, comparability,
                           # cross-source, fitness, lineage, false-consensus, definitions
pipelines/evaluation/      # blind benchmark runner (restricted)
rag/                       # India geo aliases, retrieval + LLM client (lineage
                           # and false-consensus logic live in pipelines/forensics/)
data/fixtures/public/      # synthetic demo fixtures generated by seed
data/benchmark-restricted/ # CAG case registry (isolated, never loaded at runtime)
docs/                      # specification, ADRs, benchmark protocol, UNLEASH report
infra/docker/              # Dockerfiles + compose (api, web, postgres)
tests/                     # unit + API lifecycle + seed + leakage guard
```

---

## The demo case (synthetic, reproducible)

`POST /seed/demo` writes six byte-stable CSV fixtures and runs the full stack:

1. Two micro-irrigation annual releases reporting beneficiaries in **lakh** then **crore** → unit/definition/scope **semantic drift**, gated `not_comparable`.
2. A district irrigation table with a planted reporting spike → **anomaly** findings (IQR).
3. Scheme payments with uniform leading digits → **Benford** nonconformity (MAD 0.056).
4. Two "sources" quoting one scheme total, where the digest derives from the release → **cross-source conflict** plus a **false-consensus** finding (diversity ratio 0.5).

Everything above is marked synthetic in source ids/titles. No real-world accusations; no benchmark labels.

---

## Validation strategy

BDD is evaluated against independently verified historical findings from CAG reports used as a **hidden benchmark** (register → map → freeze → blind run → adjudicate → measure). See `docs/benchmark-protocol.md`. A "not detectable" outcome is a finding, not a failure: it documents a data-access or observability gap. No performance claims until measured.

**Try the blind runner now:**
```bash
uv run bdd eval run
uv run bdd eval adjudicate <run_id> BDD-001 --decision not_detectable
uv run bdd eval report <run_id>
```

---

## Governance rules (mandatory)

- No raw source replacement: add a versioned artifact + supersession link.
- Benchmark labels never enter app seed data, retrieval index, prompts or logs (enforced by `tests/test_leakage.py`).
- Every displayed finding carries at least one evidence link and one provenance record; high/critical findings need human confirmation before external sharing.
- Secrets never committed; `.env.example` placeholders only.

---

## Documents

- `docs/specification/*.docx`, implementation blueprint plus deliverables pack
- `docs/benchmark-protocol.md`, blinded CAG evaluation protocol
- `docs/adr/ADR-0001-repository-layout.md`
- `docs/UI_Finish_Gate_Report.md`
- `docs/PROTOTYPE_VIDEO_SCRIPT.md`, UNLEASH prototype video walkthrough script
- [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md), what is built, what is still open, and the commands to pick each open item back up

---

## Status

Launch-ready v1.3: v1.0 platform + Benford screening + fuzzy geo resolution + `bdd` CLI + blind benchmark evaluation runner (see Roadmap for the ledger).

For the current build state, what is deployed versus what is only on `main`, and the exact steps remaining, see [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).

---

## Roadmap

### Done (v1.0)

- [x] Immutable ingestion: SHA-256 freeze store, parser-version pinning, manifests
- [x] Column profiler: nulls/distributions/candidate keys/duplicates + PII hints (Aadhaar, PAN, mobile…)
- [x] Data fitness score (A–F) with weighted component breakdown
- [x] Semantic engines: unit/fiscal-year normalization, definition cards, drift detection (definition/unit/denominator/scope) scored by semantic impact
- [x] Comparability gates (geography/temporal/unit/definition) before any reconciliation
- [x] Cross-source contradiction engine (`conflict` / `explainable` / `not_comparable`)
- [x] False-consensus detection via evidence-diversity ratio
- [x] **Benford's law digit screening** - Nigrini MAD conformity bands, applicability guards (value count, magnitude span); live demo fixture
- [x] **Fuzzy entity resolution** - RapidFuzz normalization of place-name variants ("Adabari T.E." ~ "Adabari"); fuzzy geography gate powers cross-source compare
- [x] Evidence lineage graph per artifact (raw → parser → profile → rule → finding)
- [x] Persistence: SQLAlchemy dual-mode (SQLite default / Postgres), idempotent hash-keyed findings
- [x] Background jobs with persisted step-level progress; anomaly queue capped at strongest 12 signals per artifact
- [x] Web dashboard: ingest w/ live job steps, profiler views, findings queue + reviewer decisions, compare workbench, lineage visualization, Benford observed-vs-expected digit bars
- [x] Ask Detective: deterministic cited synthesis; optional LLM with hard safety gate
- [x] **`bdd` CLI**: init/serve/seed/ingest/artifacts/show/findings/review/ compare/ask/summary, every list command `--json`-scriptable
- [x] Synthetic demo corpus (one-click seed: drift + anomaly + conflict + consensus + Benford demos) and CI incl. docker builds and benchmark-leakage guard

### Achieved quality gates

- 155 passing tests: API lifecycle, engine math vectors, CLI commands, seed idempotency (reruns write zero duplicates), Ask-Detective safety gate, blind-run label-exclusion guard, benchmark-leakage guard
- Governance: the API layer has zero import path to the restricted registry (structurally verified); every label read is access-logged
- `ruff` clean; Next.js production build clean; both Docker images build in CI
- End-to-end verified: seed → dashboard → compare → ask → lineage on a fresh database (including live free-tier deploy)

### In progress: Tier 1 remainder

- [ ] **Seasonal/trend-aware anomaly baseline** expected value from rolling median or STL residual instead of flat mean, cutting false positives on cyclical data

### Next: Tier 2, real RAG and agent (spec Sprint 4)

- [ ] Qdrant + embeddings over chunked dataset content and scheme documents (compose already ships Qdrant)
- [ ] PDF/document ingestion so drift checks cover policy text, not just tables
- [ ] LangGraph investigation flow per spec §15: scope_guard → retrieve_evidence → assess_sufficiency → refuse_or_plan → deterministic_tools → cited_memo → claim_safety_check
- [x] Hindi question retrieval bridge (Devanagari tokenizer + curated domain-word map, bilingual refusal text), full Hindi/Hinglish NLU via Bhashini/Sarvam still open

### Next: Tier 3, production hardening

- [ ] JWT auth + RBAC (reviewer/admin roles for the human-review gate)
- [ ] Durable job queue (Arq/Celery + Redis) surviving restarts, with retries
- [ ] S3/MinIO object store for raw artifacts + presigned uploads
- [ ] Alembic versioned migrations replacing create_all
- [ ] OpenTelemetry traces + Prometheus metrics (spec NFR)
- [ ] DuckDB query engine for 10 GB+ files

### Later: Tier 4, product moat

- [ ] Scheduled source monitors: re-fetch registered URLs on a cron, alert when a portal silently revises published numbers
- [ ] One-click case-file export (PDF: findings + lineage + reviewer sign-off)
- [x] **Blind benchmark runner** (`bdd eval run|adjudicate|report`) - label-blind investigation pass, logged label reveal at adjudication, append-only ledger, metrics with explicit denominators (detectability rate null until cases are adjudicated; precision/recall still require pre-registered matching)
- [ ] Public API keys for embedding BDD checks into other pipelines

> Rule that governs all of the above: no accuracy claims until the blinded CAG benchmark produces measured numbers.

---

## License

MIT (c) 2026 Deepak Gangwar
