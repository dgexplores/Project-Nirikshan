# BDD Benchmark Protocol (Blinded CAG Evaluation)

Status: v0.1 draft. Applies to all evaluation in sprints 3-5.

## Purpose

Evaluate whether BDD can independently rediscover historically documented
public-data issues using only the public data and metadata available to it,
before seeing the audit conclusion.

## Data separation (mandatory)

| Store | Contents | Who sees it |
|---|---|---|
| Public app data | Approved public artifacts + manifests + metadata | Everyone |
| Benchmark registry | CAG case registry, labels, exact affected counts | Evaluation lead only |
| Adjudication | Post-run outcomes | Evaluation lead + reviewer |

Rules:

- Benchmark labels never enter: app seed data, retrieval index, agent prompt
  files, logs, or UI roles used for investigation.
- The investigator receives the source map and permitted inputs only.
- `data/benchmark-restricted/` stays out of Docker app mounts and CI seeds.
- CI runs a leakage test: assert no benchmark label string appears in
  retrieval index or agent prompts.

## Workflow

1. **Register** - create a case registry entry from a CAG observation with
   exact citation: report title, audit period, page/paragraph, URL.
2. **Map** - locate candidate public datasets/releases that could plausibly
   expose the audited condition; document the linkage rationale.
3. **Freeze** - download immutable copies, SHA-256 them, store raw and
   normalized forms separately; write `data/manifests/` entries.
4. **Blind** - withhold conclusion text, outcome label and exact affected
   record counts from investigator inputs.
5. **Investigate** - run BDD on allowed inputs only; reviewers log hypotheses
   before label reveal.
6. **Adjudicate** - reveal benchmark; classify each case:
   `detected` / `partially_detected` / `not_detected` / `not_detectable`.
   A "not detectable" outcome documents a data-access, observability or
   semantic limitation - it is a valid result, not a failure.
7. **Measure** - report case-level and finding-level metrics with matching
   policy pre-registered; no metric is reported unless its denominator is
   defined.

## Metrics

- Case coverage: cases with enough permissible public data / registered cases
- Detectability rate: cases adjudicated detectable / cases with accessible data
- Precision = TP / (TP + FP); recall = TP / (TP + FN); F1 = 2PR / (P + R)
  only after pre-registering TP/FP/FN matching criteria
- Evidence completeness: findings with artifact + locator + reproduction
  recipe / displayed findings
- Citation correctness: sampled claims whose citation supports the claim

## Integrity

- Immutable benchmark-version hash recorded at freeze time.
- Access log on label reveal.
- No retroactive label changes; case exclusions are documented.
- Synthetic-label "illustrative" tests are allowed but must be marked as
  derived tests, never presented as CAG-linked findings.