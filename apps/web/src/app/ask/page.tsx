"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  "Which files mention beneficiaries in lakh or crore?",
  "Any unusual numbers in tube wells?",
  "Is the digest total confirmed by another source?",
];

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CitationChip({ citation }: { citation: AskCitation }) {
  const base = citation.locator.startsWith("finding:")
    ? `/findings/${encodeURIComponent(citation.locator.slice("finding:".length))}`
    : `/datasets/${encodeURIComponent(citation.artifact_id)}`;
  return (
    <Link
      href={base}
      title={`${citation.locator} — ${citation.snippet}`}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)] transition hover:border-[var(--brand)]/45"
    >
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
    // Deep link from a finding: ?q=<question>&scope=<id,id> asks it at once.
    const qs = new URLSearchParams(window.location.search);
    const q = qs.get("q") ?? "";
    const scope = (qs.get("scope") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (scope.length) setScopeIds(scope);
    if (q) {
      setQuestion(q);
      window.history.replaceState(null, "", "/ask");
      const timer = setTimeout(() => submitRef.current(q, scope), 400);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, busy]);

  async function submit(q?: string, scope?: string[]) {
    const text = (q ?? question).trim();
    if (!text || busy) return;
    setQuestion("");
    setError(null);
    setBusy(true);
    try {
      const ids = scope ?? scopeIds;
      const res = await askDetective(text, ids.length ? ids : undefined);
      setTurns((prev) => [...prev, { ...res, at: new Date().toISOString() }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const submitRef = useRef(submit);
  submitRef.current = submit;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Ask a question"
        subtitle="We only answer using your uploaded data, and we always show our sources. If we're not sure, we'll say so instead of guessing."
        meta={
          turns.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-[var(--foreground-muted)]">
              {turns.length} question{turns.length === 1 ? "" : "s"} asked
            </span>
          ) : undefined
        }
        actions={turns.length > 0 ? <Button variant="ghost" onClick={() => setTurns([])} className="text-sm">Clear</Button> : null}
      />

      {artifacts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm font-medium text-[var(--foreground-muted)]">Search within:</span>
          {artifacts.map((a) => {
            const active = scopeIds.includes(a.artifact_id);
            return (
              <button
                key={a.artifact_id}
                onClick={() =>
                  setScopeIds((prev) => (prev.includes(a.artifact_id) ? prev.filter((x) => x !== a.artifact_id) : [...prev, a.artifact_id]))
                }
                className={`rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none ${active ? "border-[var(--brand)]/40 bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--border)] bg-white text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"}`}
              >
                {a.title || a.artifact_id}
              </button>
            );
          })}
          {scopeIds.length > 0 && (
            <button onClick={() => setScopeIds([])} className="ml-1 text-sm text-[var(--foreground-faint)] underline decoration-current/30 underline-offset-2 hover:text-[var(--foreground-muted)]">
              reset
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {!turns.length && !busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Panel className="text-center">
              <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-[var(--brand)]/20 bg-[var(--brand-soft)] text-[var(--brand)]" aria-hidden>
                <SearchIcon className="size-5" />
              </div>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">Ask about your uploaded files, quality checks, or comparisons. Every answer shows exactly where it came from.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => submit(ex)}
                    className="rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-left text-sm leading-snug text-[var(--foreground-muted)] transition hover:border-[var(--brand)]/30 hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] focus-visible:outline-none"
                  >
                    &ldquo;{ex}&rdquo;
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--foreground-faint)]">Tip: click the [E1], [E2] tags in an answer to see its source. The first answer can take up to a minute while the server wakes up.</p>
            </Panel>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {turns.map((turn) => (
            <motion.div key={turn.at + turn.question} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="mb-2 flex justify-end">
                <span className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--brand)] px-4 py-2.5 text-sm leading-relaxed text-white">{turn.question}</span>
              </div>
              <Panel className="overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                  <span className="text-sm font-medium text-[var(--foreground-muted)]">
                    {turn.mode === "llm" ? "AI answer, with sources" : turn.mode === "refusal" ? "Not enough information" : "Answer, with sources"}
                  </span>
                  <ConfidencePill confidence={turn.confidence} />
                </div>
                <div className="px-4 py-3.5">
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--foreground)]">{turn.answer}</p>
                </div>

                {turn.citations.length > 0 && (
                  <div className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-3.5">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                      <span>Sources</span>
                      <span className="rounded-full bg-white px-1.5 py-0.5">{turn.citations.length}</span>
                    </div>
                    <div className="space-y-2.5">
                      {turn.citations.map((c) => (
                        <div key={c.ref} className="flex items-start gap-2.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2">
                          <CitationChip citation={c} />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{c.snippet}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {turn.suggested_next.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] px-4 py-3">
                    {turn.suggested_next.map((next, i) => (
                      <span key={i} className="rounded-full border border-dashed border-[var(--border-strong)] px-2.5 py-1 text-xs text-[var(--foreground-muted)]">
                        Try: {next}
                      </span>
                    ))}
                  </div>
                )}
              </Panel>
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground-muted)]">
            <Spinner /> Looking through your data…
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-3 rounded-xl border border-[var(--critical)]/25 bg-[var(--critical-soft)] px-3.5 py-2.5 text-sm text-[var(--critical)]">{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="sticky bottom-4 mt-6 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question… (Hindi or English)"
          className="flex-1 rounded-full border border-[var(--border-strong)] bg-white px-4 py-3 text-sm shadow-lg backdrop-blur placeholder:text-[var(--foreground-faint)] focus:border-[var(--brand)]/50 focus:outline-none"
        />
        <Button type="submit" disabled={busy || !question.trim()} className="justify-center px-5">
          {busy ? <Spinner className="size-4" /> : "Ask"}
        </Button>
      </form>
      <p className="mt-2 text-center text-xs text-[var(--foreground-faint)]">We only answer with proof. If we can&apos;t find it, we&apos;ll tell you honestly.</p>
    </div>
  );
}
