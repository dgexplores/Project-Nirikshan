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
      title={citation.snippet}
      className="inline-flex items-center gap-1 rounded border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-1.5 py-0.5 font-mono text-[11px] text-[#fbbf24] transition hover:border-[#f59e0b]/60"
    >
      <span aria-hidden>◈</span>{citation.ref}
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
      <HelpBanner title="Ask in Hindi or English — cited or refused" desc="Every answer needs evidence [E#]. Try the example chips below, or restrict to one dataset via the scope pills." href="/datasets" cta="See datasets" />
      <PageHeader
        title="Ask Detective"
        subtitle="Answers are synthesized only from stored evidence and must carry citations — otherwise the detective refuses to answer."
        actions={
          turns.length > 0 ? (
            <Button variant="ghost" onClick={() => setTurns([])} className="text-xs">Clear</Button>
          ) : null
        }
      />

      {artifacts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 uppercase tracking-wider text-white/35">Evidence scope:</span>
          {artifacts.map((a) => {
            const active = scopeIds.includes(a.artifact_id);
            return (
              <button
                key={a.artifact_id}
                onClick={() =>
                  setScopeIds((prev) =>
                    prev.includes(a.artifact_id) ? prev.filter((x) => x !== a.artifact_id) : [...prev, a.artifact_id],
                  )
                }
                className={`rounded-full border px-2.5 py-1 font-mono transition ${
                  active ? "border-[#22d3ee]/50 bg-[#22d3ee]/10 text-[#22d3ee]" : "border-white/10 text-white/40 hover:border-white/25"
                }`}
              >
                {a.artifact_id}
              </button>
            );
          })}
          {scopeIds.length > 0 && (
            <button onClick={() => setScopeIds([])} className="ml-1 text-white/35 underline-offset-2 hover:text-white/70 hover:underline">
              reset
            </button>
          )}
        </div>
      )}

      <div className="space-y-5">
        {!turns.length && !busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Panel className="text-center">
              <div className="text-4xl" aria-hidden>🕵️</div>
              <p className="mt-3 text-sm text-white/55">
                Ask about stored artifacts, profiles, findings and comparisons.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => submit(ex)}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 transition hover:border-[#f59e0b]/40 hover:text-[#fbbf24]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </Panel>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {turns.map((turn) => (
            <motion.div
              key={turn.at + turn.question}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-3 text-right">
                <span className="inline-block rounded-xl rounded-br-sm border border-white/10 bg-white/[0.05] px-3.5 py-2 text-sm">{turn.question}</span>
              </div>
              <Panel>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                    {turn.mode === "llm" ? "LLM synthesis · cited" : turn.mode === "refusal" ? "Refusal" : "Deterministic · cited"}
                  </span>
                  <ConfidencePill confidence={turn.confidence} />
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/85">{turn.answer}</p>

                {turn.citations.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
                    {turn.citations.map((c) => (
                      <div key={c.ref} className="flex items-start gap-2 text-xs">
                        <CitationChip citation={c} />
                        <div className="min-w-0">
                          <span className="font-mono text-[11px] text-white/45">{c.locator}</span>
                          <p className="truncate text-white/35">{c.snippet}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {turn.suggested_next.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {turn.suggested_next.map((next, i) => (
                      <span key={i} className="rounded-full border border-dashed border-white/15 px-2 py-0.5 text-[11px] text-white/40">
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel inline-flex items-center gap-2 p-4 text-sm text-white/50">
            <Spinner /> Retrieving evidence…
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-xs text-[#f87171]">{error}</p>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="sticky bottom-4 mt-6 flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about the frozen evidence…"
          className="flex-1 rounded-xl border border-white/15 bg-[#0b1120]/90 px-4 py-3 text-sm shadow-lg backdrop-blur placeholder:text-white/25 focus:border-[#f59e0b]/50 focus:outline-none"
        />
        <Button type="submit" disabled={busy || !question.trim()} className="justify-center px-5">
          {busy ? <Spinner className="size-4" /> : "Ask"}
        </Button>
      </form>
    </div>
  );
}
