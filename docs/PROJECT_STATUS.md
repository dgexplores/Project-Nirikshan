# Project status and handoff

Last updated: 2026-09-03, at commit `baccbd0` on `main`.

This is the working record of what is finished, what is not, and the exact
commands to pick each remaining item back up. The README is the pitch. This
file is the checklist.

---

## Current state at a glance

| Thing | State |
|---|---|
| Code on `main` | Committed and pushed, working tree clean |
| GitHub Actions CI | Passing, all 4 jobs |
| Backend tests | 157 passing |
| Web production build | Clean, no new dependencies added |
| Backend deploy | **Down.** The Railway trial expired and the service was stopped. Needs moving to Render, see below |
| Frontend deploy (Vercel) | Live and current, but every API call fails while the backend is down |
| Real data.gov.in findings | Committed in the repo. Not reachable on the demo while the backend is down, and will need re-ingesting into the new database |
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

### Interface flow and clutter

- Every page used to open with four stacked bands before any content: a
  breadcrumb, a title, a permanent help banner, then the controls. Breadcrumbs
  now appear only on the two detail pages, where they are the way back out.
  The help banner is gone from the pages whose subtitle already said the same
  thing, and on Your files it appears only while nothing has been uploaded.
- The overview no longer repeats the severity and kind breakdown. That view
  lives on Problems found, where the same bars also work as filters.
- Problems found accepts a `?file=` scope, so a file's problem count is no
  longer a dead end. The file detail page links into it, the scope shows as a
  chip you can clear, and the breakdowns recalculate for that file.
- Dropped the "How it works" nav item, which pointed at an anchor on a
  different page. Every route got smaller as a result of the cleanup.

### Repository health

- A YAML syntax error had made `.github/workflows/ci.yml` invalid since
  2026-08-26, so every run since then reported failure with zero jobs actually
  executing. Fixed, all 4 jobs now pass.
- Two document-generation scripts wrote to a hardcoded absolute path from one
  machine, so they only ran there. They now write into `docs/specification/`
  relative to the repository and work on any checkout.
- Two malformed rows in `data/source-register.csv` had a stray comma shifting
  every field after `resource_url` by one. Fixed.
- Every push-triggered Vercel deploy had failed since `vercel.json` was added,
  four in a row, each dying in about 3 seconds. The file described an app at
  the repository root, so `npm ci` ran where no `package-lock.json` exists and
  exited with EUSAGE before any build began. The live site had been serving a
  two-day-old build, kept alive only by manual CLI deploys run from inside
  `apps/web`. Both commands now target `apps/web` and push-triggered deploys
  succeed again.

---

## What is left

### 1. Put the backend back up, on Render

Railway answers `404 Application not found`. Its logs show the service built,
started and served a request, then received `Stopping Container`, so nothing
crashed. The Railway CLI states the cause plainly: "Your trial has expired.
Please select a plan to continue using Railway." A redeploy is refused for the
same reason, so this cannot be fixed on Railway without paying.

`render.yaml` is the free-tier replacement and now actually works. Two faults
that would have broken the move are fixed in commit `baccbd0`: Render hands
out a `postgres://` connection string that SQLAlchemy no longer accepts, and
the blueprint wired `BACKEND_ORIGIN` from a bare hostname with no scheme. It
also no longer deploys a second copy of the dashboard, since Vercel serves it.

Deploying needs a browser, because Render has to be authorised against this
private repository:

1. Go to https://dashboard.render.com/blueprints and choose New Blueprint
   Instance.
2. Connect the `dgexplores/bharat-data-detective` repository. Render will
   need permission to read a private repo.
3. Render reads `render.yaml` and offers `bdd-api` plus a free `bdd-db`.
   Apply it. The first Docker build takes several minutes.
4. Copy the service URL it gives you, of the form
   `https://bdd-api-XXXX.onrender.com`, and check it answers:

```bash
curl https://bdd-api-XXXX.onrender.com/health
```

5. Point the dashboard at it and redeploy the frontend:

```bash
cd apps/web
vercel env add BACKEND_ORIGIN production   # paste the Render URL
vercel --prod --yes
```

6. Seed the demo corpus, then re-ingest the real files, since the new
   database starts empty:

```bash
curl -X POST https://bdd-api-XXXX.onrender.com/seed/demo -H 'Content-Length: 0'
```

   The real datasets and their exact artifact and source ids are in
   [`data/real-samples/README.md`](../data/real-samples/README.md) and
   [`data/source-register.csv`](../data/source-register.csv).

Two free-tier limits to plan around: a free web service sleeps after about 15
minutes idle and takes roughly a minute to answer the next request, so warm it
up before a demo or a recording, and a free Postgres instance is removed after
30 days.

### 2. Record the prototype video

The full script, including the click path through the app, is in
[`PROTOTYPE_VIDEO_SCRIPT.md`](PROTOTYPE_VIDEO_SCRIPT.md). The deployed site is
current, so a recording made now shows the real interface.

### 3. Known smaller items

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
uv run pytest                    # 157 tests
uv run ruff check .
cd apps/web && npx tsc --noEmit && npm run build
```

Note that `main` has a pre-commit hook requiring the `/simplify` review to run
against the staged diff before a commit is accepted.
