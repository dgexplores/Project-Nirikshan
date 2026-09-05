"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { HashText, PageHeader } from "@/components/PageChrome";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { Panel } from "@/components/ui/Panel";
import { compareArtifacts, listArtifacts, getProfile, type ArtifactSummary } from "@/lib/api";
import type { CompareResponse, DatasetProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GATE_LABEL, GATE_STATE_LABEL } from "@/lib/labels";
import { BarList } from "@/components/charts/BarList";

/** Plain-language gap between the two totals being compared. */
function totalsGap(totals: Record<string, { column: string; total: number }>) {
  const values = Object.values(totals).map((t) => t.total);
  if (values.length !== 2) return null;
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  return { diff: hi - lo, pct: lo > 0 ? ((hi - lo) / lo) * 100 : null };
}

const OVERALL_LABEL: Record<string, string> = {
  comparable: "Yes, you can compare these",
  partial: "Only partly comparable",
  not_comparable: "No, not comparable yet",
};

const GATE_STATE_CLASS: Record<string, string> = {
  comparable: "border-[var(--good)]/25 bg-[var(--good-soft)] text-[var(--good)]",
  partial: "border-[var(--medium)]/25 bg-[var(--medium-soft)] text-[var(--medium)]",
  not_comparable: "border-[var(--high)]/25 bg-[var(--high-soft)] text-[var(--high)]",
  unknown: "border-[var(--border-strong)] text-[var(--foreground-muted)] bg-[var(--background)]",
};

function numericColumns(profile: DatasetProfile | null): string[] {
  if (!profile) return [];
  // Offer measurements only. Comparing a call id or a month against another
  // dataset's is meaningless, and this picker used to list them. `is_metric`
  // comes from the backend so the rule is defined once, in Python; the dtype
  // test is the fallback for profiles stored before that field existed.
  return profile.columns
    .filter((c) => c.is_metric ?? (c.dtype.startsWith("Int") || c.dtype.startsWith("Float")))
    .map((c) => c.name);
}

function shortId(id: string) {
  return id.length > 22 ? `${id.slice(0, 20)}…` : id;
}

function FileMeta({ id, artifacts }: { id: string; artifacts: ArtifactSummary[] }) {  const a = artifacts.find((x) => x.artifact_id === id);
  if (!a) return null;
  const bits = [
    a.row_count != null ? `${a.row_count.toLocaleString("en-IN")} rows` : null,
    a.release_date,
  ].filter(Boolean);
  if (!bits.length) return null;
  return <span className="mt-1 block text-xs font-normal text-[var(--foreground-faint)]">{bits.join(" · ")}</span>;
}

export default function ComparePage() {
  const [artifacts, setArtifacts] = useState<ArtifactSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [colA, setColA] = useState("");
  const [colB, setColB] = useState("");
  const [profileA, setProfileA] = useState<DatasetProfile | null>(null);
  const [profileB, setProfileB] = useState<DatasetProfile | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);

  useEffect(() => {
    listArtifacts()
      .then(async (res) => {
        setArtifacts(res.items);
        // Deep link from a finding: ?a=<id>&b=<id> preselects the pair.
        const qs = new URLSearchParams(window.location.search);
        const ids = new Set(res.items.map((a) => a.artifact_id));
        const qa = qs.get("a") ?? "";
        const qb = qs.get("b") ?? "";
        if (qa && qb && ids.has(qa) && ids.has(qb)) {
          setAId(qa);
          setBId(qb);
          return;
        }
        // Default to the first two files that actually have measurable
        // numbers. Files like call logs have none, preselecting one would
        // leave an empty column box and a dead Compare button.
        const withMetrics: string[] = [];
        for (const a of res.items) {
          try {
            const p = await getProfile(a.artifact_id);
            if (numericColumns(p).length > 0) withMetrics.push(a.artifact_id);
          } catch {
            // A file whose profile won't load can't be compared either.
          }
          if (withMetrics.length >= 2) break;
        }
        const fallback = withMetrics.length >= 2 ? withMetrics : res.items.map((a) => a.artifact_id);
        if (fallback.length >= 2) {
          setAId(fallback[0]);
          setBId(fallback[1]);
        }
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (aId) getProfile(aId).then(setProfileA).catch(() => setProfileA(null));
    else setProfileA(null);
    setColA("");
  }, [aId]);

  useEffect(() => {
    if (bId) getProfile(bId).then(setProfileB).catch(() => setProfileB(null));
    else setProfileB(null);
    setColB("");
  }, [bId]);

  const colsA = useMemo(() => numericColumns(profileA), [profileA]);
  const colsB = useMemo(() => numericColumns(profileB), [profileB]);

  // Autofill heals stale picks too: if the chosen column is not in the
  // current file's list (e.g. right after switching files, while the new
  // profile was still loading), fall back to that file's first column
  // instead of sending a column the file doesn't have. File B prefers the
  // same column name as File A when both files share it, since comparing
  // like with like is the common case.
  useEffect(() => {
    if (colsA.length && !colsA.includes(colA)) setColA(colsA[0]);
    if (colsB.length && !colsB.includes(colB)) setColB(colA && colsB.includes(colA) ? colA : colsB[0]);
  }, [colsA, colsB, colA, colB]);

  function swap() {
    setAId(bId);
    setBId(aId);
  }

  interface HistoryEntry { a: string; ca: string; b: string; cb: string; overall: string; at: string }
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("bdd-compare-history") ?? "[]") as HistoryEntry[]);
    } catch {
      setHistory([]);
    }
  }, []);
  function saveHistory(entry: HistoryEntry) {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => !(h.a === entry.a && h.b === entry.b && h.ca === entry.ca && h.cb === entry.cb))].slice(0, 5);
      try {
        localStorage.setItem("bdd-compare-history", JSON.stringify(next));
      } catch {
        // Private browsing etc: history is a convenience, not a requirement.
      }
      return next;
    });
  }

  async function run() {
    if (!aId || !bId || !colA || !colB) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await compareArtifacts({ artifact_a: aId, column_a: colA, artifact_b: bId, column_b: colB });
      setResult(res);
      saveHistory({ a: aId, ca: colA, b: bId, cb: colB, overall: res.overall, at: new Date().toISOString() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function rerun(h: { a: string; ca: string; b: string; cb: string }) {
    setAId(h.a);
    setBId(h.b);
    setColA(h.ca);
    setColB(h.cb);
    setResult(null);
  }

  if (error && !result && !artifacts) return <ErrorState message={error} onRetry={() => setError(null)} />;

  const overallTone = result ? GATE_STATE_CLASS[result.overall] ?? GATE_STATE_CLASS.unknown : "";

  return (
    <div>
      <PageHeader
        title="Compare two files"
        subtitle="We never say one side is wrong, we just check whether the two files can be fairly compared, and show you what we found."
        meta={
          artifacts ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-[var(--foreground-muted)]">{artifacts.length} files available</span>
          ) : undefined
        }
      />

      {!artifacts?.length ? (
        <Panel>
          <p className="text-center text-sm text-[var(--foreground-muted)]">Upload at least two files first so you have something to compare.</p>
        </Panel>
      ) : (
        <>
          <Panel className="mb-5 p-4">
            <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto_1fr_1fr_auto]">
              <label className="block text-sm font-medium text-[var(--foreground-muted)]">
                File A
                <Select value={aId} onChange={(e) => setAId(e.target.value)} className="mt-1.5 text-sm">
                  {artifacts.map((a) => (
                    <option key={a.artifact_id} value={a.artifact_id}>
                      {a.title || a.artifact_id}
                    </option>
                  ))}
                </Select>
                <FileMeta id={aId} artifacts={artifacts} />
              </label>
              <label className="block text-sm font-medium text-[var(--foreground-muted)]">
                Column to compare
                {profileA && colsA.length === 0 ? (
                  <span className="mt-1.5 block rounded-lg border border-[var(--medium)]/25 bg-[var(--medium-soft)] px-3 py-2 text-xs font-normal leading-relaxed text-[var(--medium)]">
                    This file has no measurable numbers (only names, IDs, dates), so there is nothing to compare here. Pick another file above.
                  </span>
                ) : (
                  <Select value={colA} onChange={(e) => setColA(e.target.value)} className="mt-1.5 text-sm">
                    {colsA.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </label>
              <span className="hidden pb-1 text-center md:block">
                <button
                  onClick={swap}
                  title="Swap the two files"
                  aria-label="Swap the two files"
                  className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--foreground-muted)] transition hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"
                >
                  ⇄
                </button>
              </span>
              <label className="block text-sm font-medium text-[var(--foreground-muted)]">
                File B
                <Select value={bId} onChange={(e) => setBId(e.target.value)} className="mt-1.5 text-sm">
                  {artifacts.map((a) => (
                    <option key={a.artifact_id} value={a.artifact_id}>
                      {a.title || a.artifact_id}
                    </option>
                  ))}
                </Select>
                <FileMeta id={bId} artifacts={artifacts} />
              </label>
              <label className="block text-sm font-medium text-[var(--foreground-muted)]">
                Column to compare
                {profileB && colsB.length === 0 ? (
                  <span className="mt-1.5 block rounded-lg border border-[var(--medium)]/25 bg-[var(--medium-soft)] px-3 py-2 text-xs font-normal leading-relaxed text-[var(--medium)]">
                    This file has no measurable numbers (only names, IDs, dates), so there is nothing to compare here. Pick another file above.
                  </span>
                ) : (
                  <Select value={colB} onChange={(e) => setColB(e.target.value)} className="mt-1.5 text-sm">
                    {colsB.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </label>
              <Button onClick={run} disabled={running || !aId || !bId || !colA || !colB || aId === bId} className="justify-center whitespace-nowrap">
                {running ? (
                  <>
                    <Spinner className="size-3.5" /> Checking…
                  </>
                ) : (
                  "Compare"
                )}
              </Button>
            </div>
            <p className="mt-2.5 text-center text-sm text-[var(--foreground-faint)]">
              Tip: even if two columns have the same name, they might not mean the same thing. We check for that.
              {aId !== "" && aId === bId && " Pick two different files above to start comparing."}
            </p>
          </Panel>

          {error && (
            <div className="mb-4 rounded-xl border border-[var(--critical)]/25 bg-[var(--critical-soft)] px-4 py-3 text-sm text-[var(--critical)]" onClick={() => setError(null)}>
              {error} <span className="ml-2 cursor-pointer underline decoration-current/40 underline-offset-2">(dismiss)</span>
            </div>
          )}

          {result && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className={cn("flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4", overallTone)}>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Result</div>
                  <div className="mt-1 text-xl font-bold tracking-tight">{OVERALL_LABEL[result.overall] ?? result.overall.replaceAll("_", " ")}</div>
                  <div className="mt-1 max-w-md text-sm font-normal leading-relaxed opacity-80">
                    {result.overall === "comparable" && "The two totals talk about the same thing in the same way. You can fairly read them side by side."}
                    {result.overall === "partial" && "Mostly the same, but something needs adjusting or clarifying before you trust the gap."}
                    {result.overall === "not_comparable" && "Stop here: these numbers don't mean the same thing yet. Comparing them would mislead."}
                    {!["comparable", "partial", "not_comparable"].includes(result.overall) && "Not enough shared ground to judge yet."}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 text-sm sm:items-end">
                  {Object.entries(result.totals).map(([aid, t]) => (
                    <span key={aid} className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-current/20 bg-white/60 px-3 py-1">
                      <HashText hash={aid} /> <span className="opacity-60">·</span> {t.column}: <strong>{Math.round(t.total).toLocaleString("en-IN")}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {Object.keys(result.totals).length === 2 && (
                <Panel className="p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">How the two totals compare</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-faint)]">
                    Both drawn on the same scale, so the gap you see is the real gap.
                  </p>
                  <BarList
                    className="mt-3"
                    data={Object.entries(result.totals).map(([aid, t]) => ({
                      key: aid,
                      label: `${artifacts.find((a) => a.artifact_id === aid)?.title || aid} · ${t.column}`,
                      value: Math.round(t.total),
                    }))}
                  />
                  {(() => {
                    const gap = totalsGap(result.totals);
                    if (!gap) return null;
                    return (
                      <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
                        They differ by{" "}
                        <strong className="font-semibold text-[var(--foreground)]">
                          {Math.round(gap.diff).toLocaleString("en-IN")}
                        </strong>
                        {gap.pct !== null && <>, so the bigger one is {gap.pct.toFixed(1)}% higher.</>}
                      </p>
                    );
                  })()}
                </Panel>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel className="p-4">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">Are they talking about the same thing?</h3>
                  <ul className="mt-3 space-y-2">
                    {result.gates.map((gate, i) => (
                      <motion.li
                        key={gate.dimension}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 + i * 0.05 }}
                        className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-white p-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[var(--foreground)]">{GATE_LABEL[gate.dimension] ?? gate.dimension}</div>
                          <div className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">{gate.reason}</div>
                        </div>
                        <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide", GATE_STATE_CLASS[gate.state])}>
                          {GATE_STATE_LABEL[gate.state] ?? gate.state.replaceAll("_", " ")}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </Panel>

                <div className="space-y-4">
                  <Panel className="p-4">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">Do the numbers agree?</h3>
                    <div className="mt-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold",
                          result.contradiction.reconciliation_status === "conflict"
                            ? GATE_STATE_CLASS.not_comparable
                            : result.contradiction.reconciliation_status === "explainable"
                              ? GATE_STATE_CLASS.comparable
                              : GATE_STATE_CLASS.unknown,
                        )}
                      >
                        {result.contradiction.reconciliation_status === "conflict" ? "No, they disagree" : result.contradiction.reconciliation_status === "explainable" ? "Yes, close enough" : "Can't compare yet"}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {result.contradiction.possible_explanations.map((ex, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--foreground-faint)]" aria-hidden />
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 border-t border-[var(--border)] pt-2.5 text-xs text-[var(--foreground-faint)]">We don&apos;t say who&apos;s right, these are possible explanations to check.</p>
                  </Panel>

                  {result.drift_findings.length > 0 && (
                    <Panel className="p-4">
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">What changed between these files ({result.drift_findings.length})</h3>
                      <ul className="mt-3 space-y-2">
                        {result.drift_findings.map((d, i) => (
                          <li key={`${d.finding_id}-${i}`} className="rounded-xl border border-[var(--medium)]/20 bg-[var(--medium-soft)] p-3">
                            <div className="text-sm font-semibold capitalize text-[var(--medium)]">{(d.drift_type ?? "unknown").replaceAll("_", " ")}</div>
                            <div className="mt-1 text-xs text-[var(--foreground-muted)]">
                              &ldquo;{d.concept_id}&rdquo; changed by {(d.semantic_impact * 100).toFixed(0)}%
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-xs text-[var(--foreground-faint)]">These were also added to your problems queue for review.</p>
                    </Panel>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {history.length > 0 && (
            <Panel className="mt-4 p-4">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Recent comparisons</h3>
              <ul className="mt-2.5 space-y-1.5">
                {history.map((h, i) => (
                  <li key={`${h.a}-${h.b}-${h.ca}-${h.cb}-${i}`}>
                    <button
                      onClick={() => rerun(h)}
                      title="Load this comparison again"
                      className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-left text-sm transition hover:border-[var(--brand)]/30 hover:bg-[var(--brand-soft)]"
                    >
                      <span className="font-medium text-[var(--foreground)]">{shortId(h.a)} · {h.ca}</span>
                      <span className="text-[var(--foreground-faint)]">vs</span>
                      <span className="font-medium text-[var(--foreground)]">{shortId(h.b)} · {h.cb}</span>
                      <span className="ml-auto text-xs text-[var(--foreground-faint)]">{OVERALL_LABEL[h.overall] ?? h.overall.replaceAll("_", " ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
