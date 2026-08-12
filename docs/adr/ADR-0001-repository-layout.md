# ADR-0001: Repository and workspace layout

Date: 2026-08-13
Status: Accepted

## Context

BDD spans web UI, typed API, ingestion, forensics, graph, RAG and evaluation.
One repo must keep contracts shared and benchmark data isolated.

## Decision

Single private monorepo, uv workspace. Layout per spec section 21:
`apps/web`, `services/api`, `packages/contracts`, `pipelines/*`, `graph`,
`rag`, `data/*`, `docs/*`, `infra/docker`, `tests`.

- Python is the implementation language; uv manages environments.
- Shared contracts live in `packages/contracts` (Pydantic), imported by
  services and pipelines.
- Benchmark data lives in `data/benchmark-restricted/` and is never mounted
  into app containers or seeded.
- Raw downloaded artifacts live in `data/raw/` (gitignored); frozen fixture
  artifacts and manifests are committed.

## Consequences

- One dependency graph, one test run, simple local dev.
- Strict discipline required to keep benchmark labels out of app paths.