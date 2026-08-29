"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatBytes } from "@/components/AnimatedNumber";
import { Breadcrumb } from "@/components/Breadcrumb";
import { HelpBanner } from "@/components/OnboardingStepper";
import { HashText, PageHeader } from "@/components/PageChrome";
import { LineageViz } from "@/components/LineageViz";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import {
  analyzeArtifact,
  getFitness,
  getLineage,
  getManifest,
  getProfile,
} from "@/lib/api";
import type { DatasetProfile, FitnessScore, LineageGraph, Manifest } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "profile" | "quality" | "lineage";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Columns & profile" },
  { id: "quality", label: "Quality observations" },
  { id: "lineage", label: "Evidence lineage" },
];

const SEV_CLASS: Record<string, string> = {
  info: "border-white/20 text-white/60",
  low: "border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#38bdf8]",
  medium: "border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]",
  high: "border-[#fb923c]/40 bg-[#fb923c]/10 text-[#fb923c]",
};

function NullBar({ ratio }: { ratio: number }) {
  return (
    <span className="inline-block h-1.5 w-14 overflow-hidden rounded-full bg-white/10 align-middle">
      <motion.span
        initial={{ width: 0 }}
        animate={{ width: `${ratio * 100}%` }}
        transition={{ duration: 0.6 }}
        className={`block h-full rounded-full ${ratio > 0.5 ? "bg-[#fb923c]" : ratio > 0 ? "bg-[#fbbf24]" : "bg-emerald-500"}`}
      />
    </span>
  );
}

export default function DatasetDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);

  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [fitness, setFitness] = useState<FitnessScore | null>(null);
  const [lineage, setLineage] = useState<LineageGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    Promise.all([getManifest(id), getProfile(id), getFitness(id)])
      .then(([m, p, f]) => {
        setManifest(m);
        setProfile(p);
        setFitness(f);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(loadAll, [loadAll]);

  useEffect(() => {
    if (tab === "lineage" && !lineage) {
      getLineage(id).then(setLineage).catch((e: Error) => setError(e.message));
    }
  }, [tab, lineage, id]);

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const res = await analyzeArtifact(id);
      setAnalyzeMsg(`${res.findings_written} new finding(s) written to the queue`);
    } catch (e) {
      setAnalyzeMsg((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={loadAll} />;
  // breadcrumb needs id, handled in render below
  if (!manifest || !profile || !fitness) {
    return <div className="flex justify-center py-32"><Spinner /></div>;
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Datasets", href: "/datasets" }, { label: id }]} />
      <HelpBanner title="Inspect one dataset" desc="Switch tabs to see columns, quality flags, and the evidence lineage graph that proves every finding." href="/findings" cta="Go to Findings" />
      <PageHeader
        title={manifest.source.official_title || manifest.artifact_id}
        subtitle={`${manifest.artifact_id} · frozen ${new Date(manifest.retrieved_at).toLocaleString("en-IN")}`}
        actions={
          <>
            <Link href="/findings" className="text-xs text-[#22d3ee]/80 hover:text-[#22d3ee]">Findings queue →</Link>
            <Button variant="ghost" onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? <Spinner className="size-3.5" /> : "Re-run anomaly engines"}
            </Button>
          </>
        }
      />
      {analyzeMsg && (
        <p className="mb-4 rounded-lg border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-3 py-2 text-xs text-[#22d3ee]/90">{analyzeMsg}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="order-2 space-y-4 lg:order-1">
          <div role="tablist" aria-label="Dataset sections" className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex-1 rounded-lg px-3 py-2 text-xs font-medium transition",
                  tab === t.id ? "text-white" : "text-white/45 hover:text-white/75",
                )}
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="dataset-tab"
                    className="absolute inset-0 rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "profile" && (
              <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <Panel className="overflow-x-auto p-0">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-wider text-white/35">
                        <th className="px-4 py-3">Column</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Nulls</th>
                        <th className="px-4 py-3">Unique</th>
                        <th className="px-4 py-3">Range / mean</th>
                        <th className="px-4 py-3">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.columns.map((col, i) => (
                        <motion.tr
                          key={col.name}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                        >
                          <td className="px-4 py-3 font-mono text-xs">
                            {col.name}
                            {profile.candidate_keys.some((k) => k.length === 1 && k[0] === col.name) && (
                              <span title="candidate key" className="ml-1.5 rounded bg-[#a78bfa]/15 px-1 py-px text-[9px] uppercase text-[#a78bfa]">key</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-white/50">{col.dtype}</td>
                          <td className="px-4 py-3">
                            <span className="mr-2 inline-flex items-center gap-2 text-xs tabular-nums text-white/60">
                              {(col.null_ratio * 100).toFixed(0)}% <NullBar ratio={col.null_ratio} />
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs tabular-nums text-white/60">{col.unique_count.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 font-mono text-xs text-white/55">
                            {col.dtype.startsWith(("Int" as string)) || col.dtype.startsWith("Float")
                              ? `${col.min ?? "?"} … ${col.max ?? "?"} (μ ${(col.mean ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })})`
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {col.pii_hints.length > 0 ? (
                              <span className="rounded-full border border-[#fb923c]/40 bg-[#fb923c]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#fb923c]" title={col.pii_hints.map((h) => h.hint_type).join(", ")}>
                                PII · {col.pii_hints[0].hint_type.replace(/_/g, " ")}
                              </span>
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              </motion.div>
            )}

            {tab === "quality" && (
              <motion.div key="quality" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2.5">
                {profile.quality_observations.map((obs, i) => (
                  <motion.div key={`${obs.code}-${obs.column}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <Panel className="flex items-start justify-between gap-4 py-3.5">
                      <div>
                        <div className="text-sm font-medium">{obs.code.replaceAll("_", " ")}</div>
                        <div className="mt-0.5 text-xs text-white/45">{obs.description}</div>
                      </div>
                      <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider", SEV_CLASS[obs.severity])}>
                        {obs.severity}
                      </span>
                    </Panel>
                  </motion.div>
                ))}
                {!profile.quality_observations.length && (
                  <p className="panel p-8 text-center text-sm text-emerald-400/70">No quality issues detected by the profiler.</p>
                )}
              </motion.div>
            )}

            {tab === "lineage" && (
              <motion.div key="lineage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <Panel>
                  {lineage ? <LineageViz graph={lineage} /> : <div className="flex justify-center py-10"><Spinner /></div>}
                  <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-white/40">
                    Every displayed claim traces back through parser → profile → rule → raw evidence. Rerunning with the same
                    pinned inputs reproduces this graph deterministically.
                  </p>
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="order-1 space-y-4 lg:order-2">
          <Panel>
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex size-16 shrink-0 items-center justify-center rounded-xl border font-mono text-2xl font-bold",
                  ["A", "B"].includes(fitness.grade) ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                    : fitness.grade === "C" ? "border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]"
                    : "border-[#fb923c]/30 bg-[#fb923c]/10 text-[#fb923c]",
                )}
                title={`Fitness score ${fitness.score}`}
              >
                {fitness.grade}
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums">{fitness.score.toFixed(1)}</div>
                <div className="text-xs uppercase tracking-wider text-white/40">Data fitness</div>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              {fitness.components.map((comp) => (
                <li key={comp.name}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="capitalize text-white/60">{comp.name.replaceAll("_", " ")}</span>
                    <span className="font-mono tabular-nums text-white/45">{comp.score.toFixed(0)}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${comp.score}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className={`h-full rounded-full ${comp.score >= 75 ? "bg-emerald-500" : comp.score >= 50 ? "bg-[#fbbf24]" : "bg-[#fb923c]"}`}
                    />
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-white/30">{comp.detail}</div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Provenance</h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-white/40">SHA-256</dt>
                <dd><HashText hash={manifest.sha256} /></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/40">Source</dt>
                <dd className="font-mono">{manifest.source.source_id}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/40">Size</dt>
                <dd>{formatBytes(manifest.byte_size)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/40">Parser</dt>
                <dd className="font-mono">{manifest.parser.name}@{manifest.parser.version}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/40">Rows × cols</dt>
                <dd className="tabular-nums">{profile.row_count.toLocaleString("en-IN")} × {profile.column_count}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/40">Duplicates</dt>
                <dd className="tabular-nums">{profile.duplicate_rows}</dd>
              </div>
              {manifest.release_date && (
                <div className="flex justify-between gap-3">
                  <dt className="text-white/40">Release</dt>
                  <dd className="font-mono">{manifest.release_date}</dd>
                </div>
              )}
            </dl>
            <Link href="/compare" className="mt-4 block rounded-lg border border-dashed border-white/15 px-3 py-2 text-center text-xs text-white/50 transition hover:border-[#22d3ee]/40 hover:text-[#22d3ee]">
              Compare this dataset against another →
            </Link>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
