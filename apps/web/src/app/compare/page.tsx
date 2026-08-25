"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PageHeader, HashText } from "@/components/PageChrome";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { Panel } from "@/components/ui/Panel";
import {
  compareArtifacts,
  listArtifacts,
  getProfile,
  type ArtifactSummary,
} from "@/lib/api";
import type { CompareResponse, DatasetProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const GATE_STATE_CLASS: Record<string, string> = {
  comparable: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
  partial: "border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]",
  not_comparable: "border-[#fb923c]/40 bg-[#fb923c]/10 text-[#fb923c]",
  unknown: "border-white/15 text-white/45",
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

  const overallClass = result
    ? result.overall === "comparable" ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/5"
      : result.overall === "partial" ? "text-[#fbbf24] border-[#fbbf24]/30 bg-[#fbbf24]/5"
      : "text-[#fb923c] border-[#fb923c]/30 bg-[#fb923c]/5"
    : "";

  return (
    <div>
      <PageHeader
        title="Cross-source comparison"
        subtitle="Comparability gates run first: geography, period, unit and definition. Only a comparable pair gets reconciled — and neither side is ever declared 'wrong'."
      />

      {!artifacts?.length ? (
        <Panel><p className="text-center text-sm text-white/40">Ingest at least two datasets first.</p></Panel>
      ) : (
        <>
          <Panel className="mb-6">
            <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto_1fr_1fr_auto]">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">Source A
                <Select value={aId} onChange={(e) => setAId(e.target.value)} className="mt-1.5">
                  {artifacts.map((a) => <option key={a.artifact_id} value={a.artifact_id}>{a.title || a.artifact_id}</option>)}
                </Select>
              </label>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">Measure A
                <Select value={colA} onChange={(e) => setColA(e.target.value)} className="mt-1.5">
                  {colsA.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </label>
              <span className="pb-2 text-center text-lg text-[#f59e0b]" aria-hidden>⇄</span>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">Source B
                <Select value={bId} onChange={(e) => setBId(e.target.value)} className="mt-1.5">
                  {artifacts.map((a) => <option key={a.artifact_id} value={a.artifact_id}>{a.title || a.artifact_id}</option>)}
                </Select>
              </label>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">Measure B
                <Select value={colB} onChange={(e) => setColB(e.target.value)} className="mt-1.5">
                  {colsB.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </label>
              <Button onClick={run} disabled={running || !aId || !bId || !colA || !colB || aId === bId} className="justify-center whitespace-nowrap">
                {running ? <><Spinner className="size-3.5" /> Running gates…</> : "Compare"}
              </Button>
            </div>
          </Panel>

          {error && (
            <div className="mb-4 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-4 py-3 text-sm text-[#f87171]" onClick={() => setError(null)}>
              {error} <span className="ml-2 cursor-pointer underline">(dismiss)</span>
            </div>
          )}

          {result && (
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <div className={cn("mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4", overallClass)}>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">Gate verdict</div>
                  <div className="mt-0.5 text-xl font-semibold capitalize">{result.overall.replaceAll("_", " ")}</div>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-sm">
                  {[result.totals[result.gates[0]?.dimension ? Object.keys(result.totals)[0] : ""], ...Object.values(result.totals)].length > 0 &&
                    Object.entries(result.totals).map(([aid, t]) => (
                      <span key={aid}>
                        <HashText hash={aid} /> · {t.column}: <strong>{Math.round(t.total).toLocaleString("en-IN")}</strong>
                      </span>
                    ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Alignment tests</h3>
                  <ul className="mt-3 space-y-2.5">
                    {result.gates.map((gate, i) => (
                      <motion.li
                        key={gate.dimension}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.07 }}
                        className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] p-3"
                      >
                        <div>
                          <div className="text-sm capitalize">{gate.dimension}</div>
                          <div className="mt-0.5 text-xs text-white/40">{gate.reason}</div>
                        </div>
                        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", GATE_STATE_CLASS[gate.state])}>
                          {gate.state.replaceAll("_", " ")}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </Panel>

                <div className="space-y-4">
                  <Panel>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Reconciliation</h3>
                    <div className="mt-3 text-sm">
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
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
                    <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-white/55">
                      {result.contradiction.possible_explanations.map((ex, i) => (
                        <li key={i}>· {ex}</li>
                      ))}
                    </ul>
                  </Panel>

                  {result.drift_findings.length > 0 && (
                    <Panel>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                        Semantic drift detected ({result.drift_findings.length})
                      </h3>
                      <ul className="mt-3 space-y-2">
                        {result.drift_findings.map((d, i) => (
                          <li key={`${d.finding_id}-${i}`} className="rounded-lg border border-[#fbbf24]/20 bg-[#fbbf24]/5 p-3">
                            <div className="text-sm font-medium capitalize text-[#fbbf24]">{(d.drift_type ?? "unknown").replaceAll("_", " ")}</div>
                            <div className="mt-0.5 text-xs text-white/50">
                              concept “{d.concept_id}” · impact {(d.semantic_impact * 100).toFixed(0)}% · {d.comparability_decision.replaceAll("_", " ")}
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-[11px] text-white/35">Findings persisted to the queue for review.</p>
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
