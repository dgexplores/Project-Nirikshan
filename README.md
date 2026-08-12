# Bharat Data Detective (BDD)

AI forensic and evidence-trust layer for Indian public data.

BDD ingests public datasets and accompanying documents, profiles their
structure and quality, resolves what fields mean, compares evidence across
sources and time, and produces reviewable case files. Output is not a truth
verdict: it is an evidence-backed finding with source lineage, reproducible
checks, uncertainty, and a recommended verification action.

**Core principle:** BDD identifies evidence-backed potential inconsistencies
for review. It does not declare a source, a dataset, or a person "wrong."

## What this project is / is not

| BDD does | BDD does not |
|---|---|
| Flag potential inconsistencies, anomalies, definition changes, contradictions | Accuse beneficiaries, officials, agencies or datasets of fraud or falsity |
| Preserve raw artifacts, hashes, transformations, queries, citations | Replace statutory audits, eligibility decisions or domain verification |
| Rank records/cells/aggregates for human review | Infer sensitive personal attributes or bypass access controls |
| Explain why multiple sources may be falsely agreeing | Treat similarity, popularity or an LLM response as proof |

## Signature innovations

1. **Semantic Drift Detection** - versions definitions, units, denominators
   and boundaries; a numerical change is not comparable until the concept
   behind it is checked. Drift scored by semantic impact, not string diff.
2. **Evidence Lineage Graph** - every displayed claim traces back through
   extraction, normalization, aggregation and rule execution to raw evidence.
3. **False Consensus Detection** - several pages repeating a number are not
   independent confirmation if they trace to the same origin. BDD reports
   evidence diversity, not raw source count.
4. **Cross-source AI Forensics** - staged comparison: deterministic alignment
   (entity, time, geography, unit, denominator, release), numeric
   reconciliation, then LLM-assisted interpretation of bounded excerpts.
   The LLM proposes hypotheses; it never calculates facts or picks the
   "true" source.

## Validation strategy

BDD is evaluated against independently verified historical findings from
Comptroller and Auditor General of India (CAG) reports, used as a **hidden
benchmark**:

1. Register CAG observations with exact citations (restricted).
2. Map each to downloadable public artifacts (data.gov.in, AIKosh, ministry
   releases).
3. Freeze immutable copies with SHA-256 manifests.
4. Withhold audit conclusions from the investigator.
5. Run BDD blinded.
6. Adjudicate against the revealed labels.
7. Report case-level and finding-level metrics only where denominators and
   matching policy are defined.

A "not detectable" outcome is a finding, not a failure: it documents a
data-access or observability gap.

## Repository layout

```
apps/web/                  # Next.js UI (dashboard, case review, Ask Detective)
services/api/              # FastAPI routes, typed contracts
packages/contracts/        # shared Pydantic/JSON schemas
pipelines/ingestion/       # connectors, parsers, manifests
pipelines/forensics/       # profile, normalize, rules, comparisons
pipelines/evaluation/      # blind benchmark runner (restricted)
graph/                     # NetworkX adapter, graph schemas
rag/                       # chunking, indexing, retrieval, citations
data/fixtures/public/      # small approved public fixtures only
data/manifests/            # generated artifact manifests
data/benchmark-restricted/ # CAG case registry + labels (isolated, never seeded)
docs/                      # specification, ADRs, protocol
infra/docker/              # compose, migrations, observability
tests/                     # unit, integration, golden, adversarial
scripts/                   # developer commands, doc generators
```

## Getting started

Requirements: uv (Python >= 3.12), Docker (optional).

```bash
uv sync                      # install workspace
uv run pytest                # run tests
uv run python -m pipelines.ingestion.cli ingest <path> --out data/manifests/
```

Run the stack:

```bash
docker compose -f infra/docker/compose.yml up
```

## Governance rules (mandatory)

- No raw source replacement: add a versioned artifact + supersession link.
- No benchmark label in app seed data, retrieval index, agent prompts, logs.
- Every displayed finding carries at least one evidence link and one
  provenance record.
- Secrets never committed; `.env.example` placeholders only.
- Rules, prompts and model configs are versioned alongside code; every run
  records config hash and artifact hashes.

## Documents

- `docs/specification/Bharat_Data_Detective_BDD_Project_Specification.docx`
  - implementation blueprint (v1.0).
- `docs/specification/BDD_Final_Deliverables_and_Submission_Pack.docx`
  - deliverables register, demo script, acceptance checklist.
- `docs/benchmark-protocol.md` - blinded CAG evaluation protocol.
- `docs/adr/` - architecture decisions.

## Status

Sprint 1 in progress: repository foundation, contract schemas, ingestion
engine, profiler. No performance claims until measured.