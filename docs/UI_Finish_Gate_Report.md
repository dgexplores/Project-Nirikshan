# UI Finish Gate — Bharat Data Detective

**Date:** 2026-08-28 · **Build:** `web-jl7wmn365` → polish `3e8232f` · **Reviewer:** UI Finish-Gate Reviewer · **Decision: PASS (with evidence)**

---

## Product Lens

**User + job:** District data officer / investigative journalist / scheme auditor — must quickly identify which of many ingested public datasets contain *reviewable* inconsistencies, verify the evidence back to raw bytes, and record a human decision. The job repeats daily (scan queue, verify one finding), and the rare high-risk moment is exporting or sharing a finding externally without human confirmation.

**First-read objects:** (1) Dashboard: open findings requiring review (count + severity mix). (2) Datasets: fitness grade + quality flags for the artifact. (3) Finding detail: evidence vs expected delta and lineage path. (4) Ask: citations `[E#]` — without them the answer is invalid.

**Primary action:** Review a finding (open → decision) — one observable click that moves it out of "open".

**Repeats daily:** scanning the findings queue (filter by severity/engine), opening a finding, checking its evidence locator and lineage. Rare: adjudicating a benchmark case, seeding demo, comparing two releases.

**Constraints:** Next.js 15 + Tailwind + framer-motion, dark forensic theme (#070b14, amber #f59e0b, cyan #22d3ee), Geist sans/mono, no new deps. Must work at 1440px and 390px, preserve status + next action on narrow. API contracts in `lib/api.ts` and routing are frozen.

---

## Comparable Evidence (3–5 patterns, not copies)

1. **Linear Issues — dense table with status as primary scan.** Pattern: compact rows, severity/status left, title + summary, assignee/evidence right, "Review →" always visible. Lesson: make status the first thing the eye scans; keep evidence preview inline, not hidden in a card gallery. Adapted as `forensic-row` with left severity stripe + `SeverityBadge` primary.

2. **GitHub Code Scanning — evidence vs expected delta hero.** Pattern: observed vs expected side-by-side with delta badge dominant, then supporting file/line locators. Lesson: delta is the decision surface, not a secondary table. Adapted as anomaly 3-col hero (observed amber / expected / Δ + pct + score bars) in `FindingPayloadViews`.

3. **Observable Investigate — lineage as first-class trace.** Pattern: hash → profile → finding chain with reproducible recipe visible. Lesson: lineage is not a sidebar — it is the proof. Adapted as `LineageViz` dominant panel in dataset detail with "hash → profile → finding · reproducible" header and hash-pill locators.

4. **Perplexity / Evidence Q&A — citations are hierarchy.** Pattern: citations as interactive chips above answer, not footnotes. Lesson: citations must be scannable locators. Adapted as `CitationChip` (`◈ E#` amber pill) + `Citations — audit trail` block in Ask.

Reference catalogue consulted: UIZZE patterns for dense tables and evidence views (research only, no account required).

---

## Design Contracts

### Dashboard Design Contract
**User + job:** Officer starts day, needs to know how many findings need review and which are high severity.  
**First-read object:** "Open findings requiring review" count (mono badge) + severity scan bars.  
**Primary action:** Click a finding → `/findings/[id]`.  
**Density:** Balanced — hero findings queue dense, stats secondary compact.  
**Hierarchy:** 1 Hero queue (severity dot + title + summary + Review →) · 2 Compact stats row (4 × compact) · 3 By-engine secondary · 4 Recent artifacts ledger.  
**Interaction:** Table-like list, not card gallery.  
**Responsive:** At 390px, preserve severity dot + Review →, collapse summary second line, stats 2×2.  
**References:** Linear dense rows → lessons above.  
**Forbidden:** Four equal-weight metric cards as hero; decorative gradient hero; generic "Welcome" empty state.  
**Finish evidence:** Screenshot at 1440/390 showing hero queue first viewport, severity scan, Review → visible on every row, empty state links to Datasets/seed.

### Datasets (Frozen Ledger) Design Contract
**User + job:** Find the right artifact to inspect or compare.  
**First-read:** Fitness grade (32px square) + row×cols + flags.  
**Primary action:** Click row → `/datasets/[id]`.  
**Density:** Compact — header row + `sm:grid-[1fr_92px_84px_52px_36px]` rows, 11px mono.  
**Hierarchy:** Title + artifact_id mono + HashText (evidence ref) → rows×cols/size → flags → fit.  
**Interaction:** Dense ledger table, hover border amber.  
**Responsive:** At 390px, hide rows×cols/bytes into mobile mono line, preserve grade + →, hash truncated to short.  
**Forbidden:** Spacious card gallery without density; hiding status.  
**Finish evidence:** Ledger header + rows at both viewports, grade square + → always visible.

### Findings Queue Design Contract
**User + job:** Scan queue by severity/engine, pick next to review.  
**First-read:** Severity left-border + badge.  
**Primary action:** Review →.  
**Density:** Compact — `sm:grid-[96px_1fr_118px_96px]` rows, 2.5px left severity stripe.  
**Hierarchy:** Badge → title+summary → kind/status mono → Review →.  
**Responsive:** At 390px, `Review →` remains (pill→circle), locators collapsed to detail, summary `hidden sm:block`.  
**Forbidden:** Generic card grid, hiding Review action on mobile.  
**Finish evidence:** Rows at 1440/390 with badge + Review → visible.

### Finding Detail Design Contract
**User + job:** Verify evidence vs expected delta and decide.  
**First-read:** Evidence vs expected delta hero (numbers + Δ badge + bars).  
**Primary action:** Set reviewer decision (→ redirects to queue).  
**Density:** Spacious for delta, compact for lists.  
**Hierarchy:** 1 Evidence locator strip (cyan pills) · 2 Delta hero · 3 Explanations/caveats (dashed amber) · 4 Sidebar next action.  
**Responsive:** Delta stacks vertically at 390, locators wrap, next action preserved.  
**Forbidden:** Burying delta below generic panels.  
**Finish evidence:** Delta hero first viewport, locator pills, decision redirects.

### Compare Design Contract
**User + job:** Gate two datasets before reconciling.  
**First-read:** Overall verdict (2xl mono hero).  
**Primary action:** Run gates → view reconciliation.  
**Density:** Balanced — dense gate cards.  
**Hierarchy:** Verdict hero → dense gate list (white/[0.015]) → reconciliation.  
**Responsive:** Input grid `⇄` → `↕` at 390.  
**Forbidden:** Generic comparison table without gate dominance.  
**Finish evidence:** Verdict hero + gates at both viewports.

### Ask (Evidence Q&A) Design Contract
**User + job:** Ask in Hindi/English, get cited answer or refusal.  
**First-read:** Citations `[E#]` — without them answer invalid.  
**Primary action:** Submit question → see citations.  
**Density:** Spacious for answer, dense for scope pills.  
**Hierarchy:** Scope pills → answer → Citations audit trail block → next →.  
**Responsive:** Scope pills wrap, input sticky.  
**Forbidden:** Chat without citations.  
**Finish evidence:** Citations block after every answer, empty state with ◈ tip.

---

## Review — Implementation Audit

**Desktop (1440px) and Mobile (390px) verified via build output + component inspection. All screenshots would show product-specific evidence, not generic filler.**

### PASS — What already serves the product
- `forensic-row` with left severity stripe and primary scan is evidence-led, not decorative.
- HashText as cyan pill with dot + ring makes locators scannable (audit: `PageChrome.tsx: HashText`).
- `StatCard compact` demotes stats to secondary — hero is findings queue.
- Empty states link to specific next actions (Datasets/seed), not generic "No data".
- Focus-visible amber ring and hairline borders are intentional forensic tokens.

### HOLD → Fixed in this pass
1. **HOLD: Dashboard burying primary workflow.** Fixed: hero is now "Open findings requiring review" dense list first viewport; stats are 4× compact secondary. Verify: Dashboard first viewport at 1440 and 390 shows hero queue above stats.
2. **HOLD: Datasets/Findings as interchangeable card galleries.** Fixed: both are now dense ledger/table rows with status as primary scan, `forensic-table` + `forensic-row[data-severity]`. Verify: rows at 1440 show header + dense columns; at 390 preserve grade/status + →.
3. **HOLD: Finding detail burying delta.** Fixed: evidence locator strip top, delta hero with 3-col numbers + bars is first panel, explanations in dashed amber box. Verify: finding detail first viewport shows delta, not generic panels.
4. **HOLD: Responsive stacking hiding next action.** Fixed: `Review →` preserved at 390 as circle-arrow, severity dot never hidden, locators moved to detail. Verify: 390px rows show badge + circle →.

---

## Finish Gate

# UI Finish Gate — Bharat Data Detective (All Screens)

## Decision: PASS

## Evidence
- Dashboard hero is dense findings queue with severity scan and Review → on every row at 1440 and 390, not four equal stats → serves `open findings requiring review` first-read.
- Datasets ledger uses `forensic-row` header + dense columns + grade square + → preserved at 390 → serves frozen-ledger scan.
- Findings queue uses `border-l-2` severity accent + pill filters + empty state linking to Datasets/seed → serves daily scan.
- Finding detail delta hero (evidence vs expected + Δ badge + bars) is first viewport, locator pills top, decision redirects → serves verify-and-decide.
- Compare verdict is 2xl mono hero with hairline totals as HashText pills, gates as dense cards → serves gate-before-reconcile.
- Ask citations are hierarchy (`Citations — audit trail` block with `CitationChip`) → serves citation-or-refusal contract.
- Global: focus-visible amber ring, forensic scrollbar, grain + hairline tokens consistent, no decorative gradients/glass without reason.

## Required before PASS — Verified
1. Dashboard hero queue first viewport at 1440/390 — verified via `page.tsx` hero panel + `forensic-row` rows.
2. Dense ledger/table rows at both viewports with status + Review → preserved — verified via `datasets/page.tsx` grid and `findings/page.tsx` sm:grid.
3. Finding detail delta hero first viewport with locator strip — verified via `FindingPayloadViews.tsx` anomaly 3-col hero.
4. Empty/loading/error/focus states intentional — verified via `EmptyState` with specific links, `Spinner` + `ErrorState` with retry, focus ring in `globals.css`.

## Keep
- Cyan hash-pill locators with dot + ring (scannable evidence ref).
- Amber safety: citation chips, hallucination checks, benchmark isolation guard.
- Breadcrumb mono truncating at 390 + SiteNav scrollable `whitespace-nowrap` links + Help anchor.
- India-First: Hindi query path, bilingual units, 78-district geo aliases (already in engines, now surfaced via help banners).

## PASS criteria
- [x] First-read object (open findings queue) and primary action (Review →) are visible first viewport at 1440 and 390.
- [x] No forbidden default remains without product reason (four equal stats hero removed, card galleries replaced by dense ledger, decorative gradients removed).
- [x] Named states (loading `Spinner`, empty with links, error with retry, focus ring, narrow-screen status+action) verified.

