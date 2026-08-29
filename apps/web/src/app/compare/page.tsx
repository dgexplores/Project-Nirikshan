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

const GATE_STATE_CLASS: Record<string, string> = {
  comparable: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  partial: "border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]",
  not_comparable: "border-[#fb923c]/30 bg-[#fb923c]/10 text-[#fb923c]",
  unknown: "border-white/12 text-white/40 bg-white/[0.02]",
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

  const overallTone = result
    ? result.overall === "comparable"
      ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-400"
      : result.overall === "partial"
        ? "border-[#fbbf24]/25 bg-[#fbbf24]/[0.06] text-[#fbbf24]"
        : "border-[#fb923c]/25 bg-[#fb923c]/[0.06] text-[#fb923c]"
    : "";

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Compare" }]} />
      <HelpBanner
        title="Cross-source comparison — gates first, reconciliation second"
        desc="Pick two artifacts + same measure. Gates check geography/period/unit/definition before any number is reconciled. Blocked = do not compare."
        href="/datasets"
        cta="Datasets"
      />
      <PageHeader
        eyebrow={
          <>
            <span className="text-[#22d3ee]">RECONCILIATION LAB</span>
            <span className="text-white/20">·</span>
            <span>gates → totals → explanations</span>
            <span className="hidden text-white/20 sm:inline">·</span>
            <span className="hidden sm:inline">never declares a side wrong</span>
          </>
        }
        title="Cross-source comparison"
        subtitle="Comparability gates run first: geography, period, unit and definition. Only a comparable pair gets reconciled — and neither side is ever declared 'wrong'."
        meta={
          artifacts ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-white/45">{artifacts.length} artifacts available</span>
          ) : undefined
        }
      />

      {!artifacts?.length ? (
        <Panel>
          <p className="text-center text-sm text-white/40">Ingest at least two datasets first — need two hashes to compare.</p>
        </Panel>
      ) : (
        <>
          <Panel className="mb-5 p-4">
            <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto_1fr_1fr_auto]">
              <label className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Source A · artifact
                <Select value={aId} onChange={(e) => setAId(e.target.value)} className="mt-1.5 font-mono text-xs">
                  {artifacts.map((a) => (
                    <option key={a.artifact_id} value={a.artifact_id}>
                      {a.title || a.artifact_id}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Measure A
                <Select value={colA} onChange={(e) => setColA(e.target.value)} className="mt-1.5 font-mono text-xs">
                  {colsA.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </label>
              <span className="hidden pb-2 text-center font-mono text-lg text-[#f59e0b] md:block" aria-hidden>
                ⇄
              </span>
              <span className="pb-1 text-center font-mono text-sm text-[#f59e0b] md:hidden" aria-hidden>
                ↕ A ⇄ B
              </span>
              <label className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Source B · artifact
                <Select value={bId} onChange={(e) => setBId(e.target.value)} className="mt-1.5 font-mono text-xs">
                  {artifacts.map((a) => (
                    <option key={a.artifact_id} value={a.artifact_id}>
                      {a.title || a.artifact_id}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">
                Measure B
                <Select value={colB} onChange={(e) => setColB(e.target.value)} className="mt-1.5 font-mono text-xs">
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
                    <Spinner className="size-3.5" /> Running gates…
                  </>
                ) : (
                  "Compare"
                )}
              </Button>
            </div>
            <p className="mt-2 text-center font-mono text-[11px] text-white/25">Tip: hashes are locators — same measure name does not imply same unit/definition. Gates catch that.</p>
          </Panel>

          {error && (
            <div className="mb-4 rounded-xl border border-[#f87171]/25 bg-[#f87171]/10 px-4 py-3 text-sm text-[#f87171]" onClick={() => setError(null)}>
              {error} <span className="ml-2 cursor-pointer underline decoration-white/20 underline-offset-2">(dismiss)</span>
            </div>
          )}

          {result && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Verdict is the hero – largest visual */}
              <div className={cn("flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4", overallTone)}>
                <div>
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-widest opacity-60">Gate verdict — primary scan</div>
                  <div className="mt-1 font-mono text-2xl font-bold capitalize tracking-tight">{result.overall.replaceAll("_", " ")}</div>
                  <div className="mt-1 font-mono text-xs opacity-60">{result.gates.length} gates · {Object.keys(result.totals).length} totals</div>
                </div>
                <div className="flex flex-col gap-1.5 font-mono text-xs sm:items-end">
                  {Object.entries(result.totals).map(([aid, t]) => (
                    <span key={aid} className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
                      <HashText hash={aid} /> <span className="text-white/40">·</span> {t.column}: <strong className="text-white">{Math.round(t.total).toLocaleString("en-IN")}</strong>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel className="p-4">
                  <h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-white/40">Alignment gates — must pass before reconciliation</h3>
                  <ul className="mt-3 space-y-2">
                    {result.gates.map((gate, i) => (
                      <motion.li
                        key={gate.dimension}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 + i * 0.05 }}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-3"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-sm capitalize text-white/85">{gate.dimension}</div>
                          <div className="mt-1 font-sans text-xs leading-relaxed text-white/40">{gate.reason}</div>
                        </div>
                        <span className={cn("shrink-0 rounded-full border px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide", GATE_STATE_CLASS[gate.state])}>
                          {gate.state.replaceAll("_", " ")}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </Panel>

                <div className="space-y-4">
                  <Panel className="p-4">
                    <h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-white/40">Reconciliation — delta explanations</h3>
                    <div className="mt-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wide",
                          result.contradiction.reconciliation_status === "conflict"
                            ? GATE_STATE_CLASS.not_comparable
                            : result.contradiction.reconciliation_status === "explainable"
                              ? GATE_STATE_CLASS.comparable
                              : GATE_STATE_CLASS.unknown,
                        )}
                      >
                        {result.contradiction.reconciliation_status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {result.contradiction.possible_explanations.map((ex, i) => (
                        <li key={i} className="flex gap-2 font-sans text-xs leading-relaxed text-white/55">
                          <span className="mt-1 size-1 shrink-0 rounded-full bg-white/25" aria-hidden />
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 border-t border-white/[0.06] pt-2 font-mono text-[11px] text-white/25">Neither side declared wrong — explanations are audit prompts, not verdicts.</p>
                  </Panel>

                  {result.drift_findings.length > 0 && (
                    <Panel className="p-4">
                      <h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-white/40">Semantic drift detected ({result.drift_findings.length})</h3>
                      <ul className="mt-3 space-y-2">
                        {result.drift_findings.map((d, i) => (
                          <li key={`${d.finding_id}-${i}`} className="rounded-xl border border-[#fbbf24]/15 bg-[#fbbf24]/5 p-3">
                            <div className="font-mono text-sm font-semibold capitalize text-[#fbbf24]">{(d.drift_type ?? "unknown").replaceAll("_", " ")}</div>
                            <div className="mt-1 font-mono text-xs text-white/50">
                              concept “{d.concept_id}” · impact {(d.semantic_impact * 100).toFixed(0)}% · {d.comparability_decision.replaceAll("_", " ")}
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 font-mono text-[11px] text-white/30">Findings persisted to queue for review — scan drift before reconciling totals.</p>
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
