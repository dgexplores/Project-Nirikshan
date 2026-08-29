# Prototype Video Script: Project Nirikshan (Bharat Data Detective)

Team ID: TEAM-MSR0M2DC-A9CC53 · Target length: 6 minutes · UNLEASH LLM Innovation Challenge, Phase 2

Required sections per the challenge guidelines, all five covered below: Introduction, Demonstration, Technical Details, LLM Integration, Future Vision.

Record as a screen capture with voiceover. Practice once before the real take, the demo steps are fast but the app itself is not scripted or faked, every click below hits the real running app.

---

## 0. Before you hit record (checklist)

- [ ] Local stack running: API on :8000, web on :3000, both on the redesigned build (not the old dark-theme version, not the stale Vercel/Railway deploy unless you've redeployed today's changes there first)
- [ ] `.env` has `BDD_LLM_BASE_URL=http://localhost:11434/v1`, `BDD_LLM_MODEL=qwen2.5:3b`, and `ollama serve` running with the model pulled, so Ask Detective answers in real **llm** mode, not deterministic fallback
- [ ] Demo corpus seeded (`Load sample data` on the dashboard, or `bdd seed --reset` for a clean run)
- [ ] Browser zoomed to a size that reads clearly on a recording (125 to 150%)
- [ ] Close notifications, other tabs, anything with your name or email visible

---

## 1. Introduction: problem, objectives, approach (0:00 to 1:00)

**Say, roughly:**

> "Every year, Indian government portals publish thousands of numbers about farmers, schemes, and welfare payments. Sometimes the same scheme shows two different totals on two different sites. Sometimes a number quietly goes from lakhs to crores between one year's release and the next. Sometimes ten articles repeat one figure, and it looks like ten confirmations, but it's really one source, copied ten times. Nobody has the time to manually check this at scale.
>
> Project Nirikshan, also called Bharat Data Detective, is a forensic layer for public data. You upload a file, or point it at an open dataset, and it flags things worth a second look, always with the evidence attached, never a verdict. A human always makes the final call. That's the design principle: evidence before narrative."

**On screen:** title card or the dashboard's empty state, then cut to the seeded dashboard.

---

## 2. Demonstration: live walkthrough (1:00 to 4:00)

This is the largest block. Follow this exact click path, it's a real, working sequence end to end.

**(a) Dashboard (1:00 to 1:30)**
- Land on the overview. Point out: "6 files uploaded, 20 things found, 20 need review" and the plain-language problem list, no jargon, so a district officer or a journalist can read it without training.
- Say: "Every number on this page is real output from the pipeline you're about to see, not a mockup."

**(b) Upload a file (1:30 to 2:10)**
- Go to **Your files**. Drag a CSV onto the drop zone (use one of the sample fixtures, or a real data.gov.in file if you have one ready).
- While it processes, narrate the step list out loud as it appears: receiving, reading, saving a verified copy, checking quality, scoring.
- Land on the file's detail page. Point at the quality grade and the **Where this came from** tab, click it, show the plain-language lineage diagram (Your file, then We read it, then We checked it, then We ran a check, then What we found).
- Say: "That trace is reproducible, same file, same hash, same result, every time. That's what makes a flag defensible instead of just an opinion."

**(c) Problems found (2:10 to 2:50)**
- Go to **Problems found**. Open one finding, ideally the "Looks like copies of one source" one (false-consensus) or the Benford one (unusual digit pattern), those are the most visually distinctive.
- Show the evidence-vs-expected panel and the plain-English explanation.
- Show the review decision panel: "A human closes this out, resolved, needs more info, or not actually a problem, the tool never marks itself right."

**(d) Compare two files (2:50 to 3:20)**
- Go to **Compare**, pick two files with a unit or definition difference (the two micro-irrigation releases work well, lakh vs crore).
- Run it, show the compatibility checks running before any numbers are compared, and the result.
- Say: "It refuses to compare two numbers that don't mean the same thing yet, that's the gate that stops a lakh from getting compared to a crore by accident."

**(e) Ask Detective (3:20 to 4:00)**
- Go to **Ask**. Type a real question live (not one of the canned example chips, to prove it's not scripted), for example "What quality issues exist in the irrigation data?" or a Hindi or Hinglish question.
- Let it answer, then click one of the `[E1]` citation chips to show it jumps to the real source.
- Say: "Every answer is grounded in evidence retrieved from your own uploaded files. If there isn't enough evidence, it says so instead of guessing, that refusal is a feature, not a bug."

---

## 3. Technical details: tech stack (4:00 to 4:45)

**Say, roughly:**

> "Under the hood: a FastAPI and Python backend, Next.js and TypeScript frontend. The five forensic engines, statistical anomaly detection, semantic drift detection, cross-source contradiction, false-consensus via evidence lineage, and Benford's law digit screening, are all deterministic Python, no LLM in that loop at all, so the same bytes always produce the same finding, byte-for-byte reproducible. Everything is covered by a CI pipeline that runs the full test suite against both SQLite and Postgres and builds the Docker images on every change."

**On screen:** briefly show the GitHub repo, the test suite passing, or the architecture diagram from the README if you have one on screen.

---

## 4. LLM integration: novel use of open-source LLMs (4:45 to 5:35)

This is a required, judged section, do not skip or shorten it.

**Say, roughly:**

> "The LLM's job here is narrow and deliberate: synthesizing a cited answer from evidence the deterministic engines already retrieved, never calculating a fact, never picking a winner between two sources. We're running this demo against Qwen 2.5, an open-source model, served locally through Ollama, no API key, no per-query cost, and no data ever leaves this machine, which matters when the data is government scheme information.
>
> Three safety layers sit around the model: personal information is never sent to it in the first place, since only aggregated column-level metadata reaches the prompt, not raw rows. A wording guard rewrites or blocks any answer that tries to accuse someone of fraud or wrongdoing, in English or Hindi, because this tool flags patterns for a human to review, it never delivers a verdict. And a citation gate means an answer with no evidence reference gets replaced with an honest refusal instead of a guess. The same code path works with any OpenAI-compatible endpoint, so a team with more compute could point this at a larger open model without changing a line."

**On screen:** the Ask Detective answer from step 2(e), zoom on the citation chips and the confidence pill.

---

## 5. Future vision: impact, scale, roadmap (5:35 to 6:00)

**Say, roughly:**

> "Today this runs against a synthetic demo corpus, deliberately marked as synthetic so no real scheme or official is ever implicated by a demo run. The real test is a blind benchmark against actual CAG audit findings, register the case, freeze the public data, run the pipeline blind, then reveal the label and adjudicate, no accuracy claim until that's measured. That discipline is intentional: we'd rather show you an honest 'not yet measured' than a number we can't defend.
>
> From here: real Hindi-language understanding via Bhashini or Sarvam, PDF and policy-document ingestion so drift checks cover more than tables, scheduled monitors that catch a portal silently revising a number after publication, and a one-click case export so a finding can leave this tool with its full evidence trail intact. The goal is the same as it is today: surface what's worth checking, and always let a human make the call."

**On screen:** the roadmap section of the README, or a simple end card with the repo link.

---

## Notes for whoever's on camera or voiceover

- Don't say "AI-powered" as a throwaway line, the judges are literally scoring the LLM section, be specific about what the model does and doesn't do (synthesis only, never the source of a fact).
- If a live query is slow on the local model, that's fine to leave in, it's more credible than a suspiciously instant answer.
- If something on screen shows "synthetic" in a title, don't cut around it, say the word out loud. It's a deliberate design choice, not something to hide.
- Keep total runtime at or under 7:00. A confident 6:00 beats a rushed 7:00.
