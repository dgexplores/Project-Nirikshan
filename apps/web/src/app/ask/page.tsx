"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Breadcrumb } from "@/components/Breadcrumb";
import { HelpBanner } from "@/components/OnboardingStepper";
import { PageHeader } from "@/components/PageChrome";
import { Button } from "@/components/ui/Button";
import { ConfidencePill } from "@/components/ui/ConfidencePill";
import { Spinner } from "@/components/ui/Spinner";
import { Panel } from "@/components/ui/Panel";
import { askDetective, listArtifacts, type ArtifactSummary } from "@/lib/api";
import type { AskResponse, AskCitation } from "@/lib/types";

interface Turn extends AskResponse {
  at: string;
}

const EXAMPLES = [
  "What quality issues exist in the irrigation data?",
  "Which datasets mention beneficiaries in lakh or crore?",
  "Any outliers flagged in tube wells?",
  "Is the digest total corroborated independently?",
];

function CitationChip({ citation }: { citation: AskCitation }) {
  const base = citation.locator.startsWith("finding:")
    ? `/findings/${encodeURIComponent(citation.locator.slice("finding:".length))}`
    : `/datasets/${encodeURIComponent(citation.artifact_id)}`;
  return (
    <Link
      href={base}
      title={`${citation.locator} — ${citation.snippet}`}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#f59e0b]/25 bg-[#f59e0b]/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-tight text-[#fbbf24] transition hover:border-[#f59e0b]/40 hover:bg-[#f59e0b]/15"
    >
      <span aria-hidden className="text-[10px]">◈</span>
      <span className="truncate">{citation.ref}</span>
    </Link>
  );
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [scopeIds, setScopeIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listArtifacts().then((res) => setArtifacts(res.items)).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, busy]);

  async function submit(q?: string) {
    const text = (q ?? question).trim();
    if (!text || busy) return;
    setQuestion("");
    setError(null);
    setBusy(true);
    try {
      const res = await askDetective(text, scopeIds.length ? scopeIds : undefined);
      setTurns((prev) => [...prev, { ...res, at: new Date().toISOString() }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Ask Detective" }]} />
      <HelpBanner
        title="Ask in Hindi or English — cited or refused"
        desc="Every answer needs evidence [E#]. Try the example chips, or restrict to one dataset via scope pills — lineage is the source of truth."
        href="/datasets"
        cta="Datasets"
      />
      <PageHeader
        eyebrow={
          <>
            <span className="text-[#22d3ee]">EVIDENCE Q&A</span>
            <span className="text-white/20">·</span>
            <span>cited or refused · citations are locators</span>
          </>
        }
        title="Ask Detective"
        subtitle="Answers are synthesized only from stored evidence and must carry citations — otherwise the detective refuses. Each citation is a hash + locator you can audit."
        meta={
          turns.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-white/40">
              {turns.length} turn(s) · citations are the hierarchy
            </span>
          ) : undefined
        }
        actions={turns.length > 0 ? <Button variant="ghost" onClick={() => setTurns([])} className="text-xs">Clear</Button> : null}
      />

      {artifacts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-white/35">Evidence scope:</span>
          {artifacts.map((a) => {
            const active = scopeIds.includes(a.artifact_id);
            return (
              <button
                key={a.artifact_id}
                onClick={() =>
                  setScopeIds((prev) => (prev.includes(a.artifact_id) ? prev.filter((x) => x !== a.artifact_id) : [...prev, a.artifact_id]))
                }
                className={`rounded-full border px-2.5 py-1 font-mono text-xs transition focus-visible:outline-none ${active ? "border-[#22d3ee]/40 bg-[#22d3ee]/10 text-[#22d3ee]" : "border-white/10 bg-white/[0.02] text-white/40 hover:border-white/20 hover:text-white/65"}`}
              >
                {a.artifact_id}
              </button>
            );
          })}
          {scopeIds.length > 0 && (
            <button onClick={() => setScopeIds([])} className="ml-1 font-mono text-xs text-white/35 underline decoration-white/15 underline-offset-2 hover:text-white/65">
              reset
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {!turns.length && !busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Panel className="text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-[#22d3ee]/20 bg-[#22d3ee]/10 font-mono text-sm text-[#22d3ee]" aria-hidden>
                ◈
              </div>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">Ask about stored artifacts, profiles, findings and comparisons. Evidence is the hierarchy — every claim below will show its locator.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => submit(ex)}
                    className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-left text-xs leading-snug text-white/55 transition hover:border-[#f59e0b]/30 hover:bg-[#f59e0b]/5 hover:text-[#fbbf24] focus-visible:outline-none"
                  >
                    “{ex}”
                  </button>
                ))}
              </div>
              <p className="mt-3 font-mono text-[11px] text-white/25">Tip: cite [E#] chips are interactive — click to open the evidence artifact.</p>
            </Panel>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {turns.map((turn) => (
            <motion.div key={turn.at + turn.question} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="mb-2 flex justify-end">
                <span className="max-w-[85%] rounded-2xl rounded-br-sm border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm leading-relaxed">{turn.question}</span>
              </div>
              <Panel className="overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.015] px-4 py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-white/40">
                    {turn.mode === "llm" ? "LLM synthesis · cited" : turn.mode === "refusal" ? "Refusal — no evidence" : "Deterministic · cited"}
                  </span>
                  <ConfidencePill confidence={turn.confidence} />
                </div>
                <div className="px-4 py-3">
                  <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/85">{turn.answer}</p>
                </div>

                {turn.citations.length > 0 && (
                  <div className="border-t border-white/[0.06] bg-[#f59e0b]/[0.04] px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-[#f59e0b]/80">
                      <span>Citations — the audit trail</span>
                      <span className="rounded bg-[#f59e0b]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#f59e0b]">{turn.citations.length} locator(s)</span>
                    </div>
                    <div className="space-y-2.5">
                      {turn.citations.map((c) => (
                        <div key={c.ref} className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                          <CitationChip citation={c} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-mono text-[11px] text-white/40" title={c.locator}>
                              {c.locator}
                            </div>
                            <p className="mt-0.5 line-clamp-2 font-sans text-xs leading-relaxed text-white/35">{c.snippet}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {turn.suggested_next.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-white/[0.06] bg-white/[0.015] px-4 py-2.5">
                    {turn.suggested_next.map((next, i) => (
                      <span key={i} className="rounded-full border border-dashed border-white/12 bg-white/[0.02] px-2.5 py-1 font-mono text-[11px] text-white/40">
                        next → {next}
                      </span>
                    ))}
                  </div>
                )}
              </Panel>
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
            <Spinner /> Retrieving evidence… <span className="font-mono text-xs text-white/30">hashes + locators</span>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-3 rounded-xl border border-[#f87171]/25 bg-[#f87171]/10 px-3 py-2 font-mono text-xs text-[#f87171]">{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="sticky bottom-4 mt-6 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about the frozen evidence… (Hindi/English)"
          className="flex-1 rounded-xl border border-white/12 bg-[#0b1120]/90 px-4 py-3 font-sans text-sm shadow-lg backdrop-blur placeholder:text-white/25 focus:border-[#f59e0b]/40 focus:outline-none"
        />
        <Button type="submit" disabled={busy || !question.trim()} className="justify-center px-5">
          {busy ? <Spinner className="size-4" /> : "Ask"}
        </Button>
      </form>
      <p className="mt-2 text-center font-mono text-[11px] text-white/25">Evidence-first: no citation → refusal. Every answer is auditable via locator + hash.</p>
    </div>
  );
}
