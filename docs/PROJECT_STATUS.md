# Project status and handoff

Last updated: 2026-08-31, at commit `fb5f776` on `main`.

This is the working record of what is finished, what is not, and the exact
commands to pick each remaining item back up. The README is the pitch. This
file is the checklist.

---

## Current state at a glance

| Thing | State |
|---|---|
| Code on `main` | Committed and pushed, working tree clean |
| GitHub Actions CI | Passing, all 4 jobs |
| Backend tests | 152 passing |
| Web production build | Clean, no new dependencies added |
| Backend deploy (Railway) | Live and current |
| Frontend deploy (Vercel) | **Stale.** Serving the build from 2026-08-30, missing the hero and charts |
| Real data.gov.in findings | Present in the local database only, not on the live demo |
| Prototype video | Script written, not recorded |

---

## What is done

### Real government data, ingested and checked

Three real datasets are committed under [`data/real-samples/`](../data/real-samples/)
with full provenance (source URL, resource id, retrieval time, SHA-256) recorded
in [`data/source-register.csv`](../data/source-register.csv).

- **Punjab school Gross Enrollment Ratio, 2019-2022**, downloaded directly from
  data.gov.in, all 8 official resources (school level x gender). Running the
  anomaly engine over these produced the finding the README leads with: SAS
  Nagar (Mohali) reaching 124-145% GER by 2022, z-score 3.78, consistent across
  nearly every level and gender, backed by a steady four-year climb in the raw
  values rather than one odd row.
- **MGNREGA Punjab FY2024-25**, 6,784 rows from the official nrega.nic.in
  release via a public GitHub mirror. Ingesting it exposed a real crash in
  `run_anomalies` on zero-baseline year-over-year findings, now fixed and
  covered by a regression test.
- **Kisan Call Centre, Punjab**, a 5,000-row real sample from the data.gov.in
  Open Government Data API. It correctly yields zero anomaly findings because
  it has no numeric metric column, only an id and a calendar day and month.
  Ingesting it exposed a second real bug: the anomaly engine treated every
  numeric column as a metric and was confidently flagging record ids and
  calendar days. Fixed in `pipelines.py::_is_metric_column`.

### Backend correctness

- Zero-baseline year-over-year crash fixed, plus a regression test.
- Identifier and calendar columns excluded from anomaly and Benford checks.
- In-flight ingest lock promoted to module scope so concurrent requests for the
  same artifact id cannot race.
- Ask Detective understands Devanagari input through a curated Hindi to English
  keyword bridge, answers in the question's language, and refuses bilingually
  when evidence is thin. Verified end to end against a local open-source model
  (Ollama running `qwen2.5:3b`).

### Interface

- **Landing hero** on the root route stating what the product does, with the
  strongest open finding pulled live from the queue beside it as proof.
- **Problems found** carries three breakdowns above the list (how serious, what
  kind, which file). The severity and kind bars double as filters, so clicking
  one narrows the list and the other two breakdowns recalculate.
- **Compare** draws the two totals as bars on a shared scale with the gap
  stated in plain words underneath, instead of two text pills.
- **Your files** has a name search and shows each file's open problem count,
  linking the page to the review queue.
- Charts are plain SVG and CSS. No charting library was added.

### Accessibility, measured rather than eyeballed

- `--foreground-faint` was 2.6:1 on white and failed WCAG AA everywhere it was
  used as text. Both text tiers now clear AA (7.0:1 and 4.6:1).
- Four of five severity colors failed AA as badge text on their own soft
  backgrounds (high 4.4, critical 4.1, low 3.3, good 3.1). All five now clear
  4.5:1. Deepening them also pulled medium and high apart, which had been 0.1
  apart under deuteranopia and 4.1 apart in normal vision, on the product's
  most important signal.
- Removed the 4px colored left border on list rows. Severity was already stated
  twice per row, as a dot and as a badge carrying the word.
- Finding text now spaces out raw column identifiers, so
  `Differently_abled_persons_worked` reads as words.

### Repository health

- A YAML syntax error had made `.github/workflows/ci.yml` invalid since
  2026-08-26, so every run since then reported failure with zero jobs actually
  executing. Fixed, all 4 jobs now pass.
- Two document-generation scripts contained a hardcoded personal path that
  revealed an earlier ChatGPT-assisted session. They now write into
  `docs/specification/` relative to the repository.
- Two malformed rows in `data/source-register.csv` had a stray comma shifting
  every field after `resource_url` by one. Fixed.

---

## What is left

### 1. Redeploy the frontend, highest priority

The live demo at https://web-tau-sandy-60.vercel.app is serving the build from
2026-08-30. The landing hero, the charts, the file search and the contrast
fixes are all on `main` but are **not** on the live site a judge would open.
There is also a failed Vercel deployment in the history from 2026-08-31 that
was not investigated.

```bash
cd apps/web && vercel --prod --yes
```

The project is already linked to the correct Vercel project (`web`), so this
needs no prompts. Afterwards, confirm the hero is live by opening the URL and
checking the headline reads "Find what doesn't add up in India's public data."

The Railway backend is current and does not need redeploying. If it ever does:

```bash
railway service redeploy --service bharat-api --from-source --yes
```

### 2. Put the real findings on the live demo

The SAS Nagar GER finding that the README leads with exists only in the local
SQLite database. The deployed Railway instance still holds the synthetic seed
corpus, so a judge clicking through will not see it.

To fix, ingest the committed real samples against the production API rather
than localhost, then run the analysis. Repeat per file:

```bash
curl -X POST "https://bharat-api-production.up.railway.app/artifacts/ingest?artifact_id=art-ger-primary-girls&source_id=SRC-GER-7632450-DATAGOVIN" \
  -F "file=@data/real-samples/punjab-ger-schools-2019-2022/ger_primary_girls_punjab.csv"

curl -X POST "https://bharat-api-production.up.railway.app/artifacts/art-ger-primary-girls/analyze"
```

The exact per-file artifact ids and source ids are in
[`data/source-register.csv`](../data/source-register.csv), and
[`data/real-samples/README.md`](../data/real-samples/README.md) has the local
CLI equivalent.

### 3. Record the prototype video

The full script, including the click path through the app, is in
[`PROTOTYPE_VIDEO_SCRIPT.md`](PROTOTYPE_VIDEO_SCRIPT.md). Record it after step
1 is done, so the recording shows the current interface.

### 4. Known smaller items

- The local API process on port 8000 is running an older build that predates
  the `/dashboard/summary` route. Restart it before local testing, or run on
  another port with
  `uv run uvicorn bdd_api.main:app --app-dir services/api/src --port 8100`
  and start the web app with `BACKEND_ORIGIN=http://localhost:8100`.
- Finding titles are generated with raw column names in the backend, and the
  web app only cleans them up at render time. Fixing this at the source in
  `services/api/src/bdd_api/pipelines.py::_title_and_summary` would improve the
  CLI and API output too, but existing stored findings keep their old titles
  until they are regenerated.
- Hindi support is retrieval-side only. The interface itself is not translated.
- The `eyebrow` prop on `PageHeader` is still used by the finding detail page.
  It was removed from the three main pages.

---

## Running it locally

```bash
# Terminal 1, API
uv sync
uv run uvicorn bdd_api.main:app --app-dir services/api/src --port 8000

# Terminal 2, web
cd apps/web && npm install && npm run dev
```

Checks before any commit:

```bash
uv run pytest                    # 152 tests
uv run ruff check .
cd apps/web && npx tsc --noEmit && npm run build
```

Note that `main` has a pre-commit hook requiring the `/simplify` review to run
against the staged diff before a commit is accepted.
