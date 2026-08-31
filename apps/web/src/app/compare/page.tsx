"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Breadcrumb } from "@/components/Breadcrumb";
import { HelpBanner } from "@/components/OnboardingStepper";
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
  return profile.columns.filter((c) => c.dtype.startsWith("Int") || c.dtype.startsWith("Float")).map((c) => c.name);
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
      .then((res) => {
        setArtifacts(res.items);
        if (res.items.length >= 2) {
          setAId(res.items[0].artifact_id);
          setBId(res.items[1].artifact_id);
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

  useEffect(() => {
    if (!colA && colsA.length) setColA(colsA[0]);
    if (!colB && colsB.length) setColB(colsB[0]);
  }, [colsA, colsB, colA, colB]);

  async function run() {
    if (!aId || !bId || !colA || !colB) return;
    setRunning(true);
    setResult(null);
    try {
      setResult(await compareArtifacts({ artifact_a: aId, column_a: colA, artifact_b: bId, column_b: colB }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (error && !result && !artifacts) return <ErrorState message={error} onRetry={() => setError(null)} />;

  const overallTone = result ? GATE_STATE_CLASS[result.overall] ?? GATE_STATE_CLASS.unknown : "";

  return (
    <div>
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Compare" }]} />
      <HelpBanner
        title="We check they're comparable before comparing numbers"
        desc="Pick two files and the same column. We make sure they mean the same thing (same place, time period, and units) before comparing them."
        href="/datasets"
        cta="Your files"
      />
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
              </label>
              <label className="block text-sm font-medium text-[var(--foreground-muted)]">
                Column to compare
                <Select value={colA} onChange={(e) => setColA(e.target.value)} className="mt-1.5 text-sm">
                  {colsA.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </label>
              <span className="hidden pb-2.5 text-center text-[var(--foreground-faint)] md:block" aria-hidden>
                vs
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
              </label>
              <label className="block text-sm font-medium text-[var(--foreground-muted)]">
                Column to compare
                <Select value={colB} onChange={(e) => setColB(e.target.value)} className="mt-1.5 text-sm">
                  {colsB.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
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
            <p className="mt-2.5 text-center text-sm text-[var(--foreground-faint)]">Tip: even if two columns have the same name, they might not mean the same thing. We check for that.</p>
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
        </>
      )}
    </div>
  );
}
