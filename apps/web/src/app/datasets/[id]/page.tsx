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
import { analyzeArtifact, getFitness, getLineage, getManifest, getProfile } from "@/lib/api";
import type { DatasetProfile, FitnessScore, LineageGraph, Manifest } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "profile" | "quality" | "lineage";

const TABS: { id: Tab; label: string; meta?: string }[] = [
  { id: "profile", label: "Columns & profile" },
  { id: "quality", label: "Quality observations" },
  { id: "lineage", label: "Evidence lineage" },
];

const SEV_CLASS: Record<string, string> = {
  info: "border-white/15 text-white/50 bg-white/[0.02]",
  low: "border-[#38bdf8]/30 bg-[#38bdf8]/10 text-[#38bdf8]",
  medium: "border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]",
  high: "border-[#fb923c]/30 bg-[#fb923c]/10 text-[#fb923c]",
};

function NullBar({ ratio }: { ratio: number }) {
  return (
    <span className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-white/10 align-middle">
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
      setAnalyzeMsg(`${res.findings_written} new finding(s) written to the queue — review in Findings`);
    } catch (e) {
      setAnalyzeMsg((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={loadAll} />;
  if (!manifest || !profile || !fitness) {
    return (
      <div className="flex justify-center py-32">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Datasets", href: "/datasets" }, { label: id }]} />
      <HelpBanner
        title="Inspect one frozen artifact"
        desc="Columns & profile is the evidence inventory; lineage proves every finding is reproducible from the same hash + parser."
        href="/findings"
        cta="Findings"
      />
      <PageHeader
        eyebrow={
          <>
            <span className="text-[#22d3ee]">FROZEN ARTIFACT</span>
            <span className="text-white/20">·</span>
            <span className="font-mono normal-case tracking-tight text-white/45">{manifest.artifact_id}</span>
            <span className="hidden text-white/20 sm:inline">·</span>
            <span className="hidden sm:inline-flex">
              <HashText hash={manifest.sha256} />
            </span>
          </>
        }
        title={manifest.source.official_title || manifest.artifact_id}
        subtitle={`Frozen ${new Date(manifest.retrieved_at).toLocaleString("en-IN")} · ${manifest.source.source_id} · ${profile.row_count.toLocaleString("en-IN")} rows × ${profile.column_count} cols · ${formatBytes(manifest.byte_size)}`}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-white/60">
              <span className="text-[10px] uppercase tracking-wider text-white/35">parser</span> {manifest.parser.name}@{manifest.parser.version}
            </span>
            {manifest.release_date && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-white/60">
                <span className="text-[10px] uppercase tracking-wider text-white/35">release</span> {manifest.release_date}
              </span>
            )}
            <span className="hidden font-mono text-[11px] text-white/25 sm:inline">config {manifest.parser.config_hash.slice(0, 10)}…</span>
          </>
        }
        actions={
          <>
            <Link
              href="/findings"
              className="hidden rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.04] sm:inline-flex"
            >
              Findings queue →
            </Link>
            <Button variant="ghost" onClick={handleAnalyze} disabled={analyzing} className="text-xs">
              {analyzing ? <Spinner className="size-3.5" /> : "Re-run engines"}
            </Button>
          </>
        }
      />
      {analyzeMsg && (
        <p className="mb-4 rounded-lg border border-[#22d3ee]/25 bg-[#22d3ee]/5 px-3 py-2 text-xs text-[#22d3ee]/90">{analyzeMsg}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_324px]">
        <div className="order-2 space-y-4 lg:order-1">
          <div role="tablist" aria-label="Dataset sections" className="flex gap-1 rounded-xl border border-white/8 bg-white/[0.018] p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex-1 rounded-lg px-3 py-2 text-xs font-medium transition focus-visible:outline-none",
                  tab === t.id ? "text-white" : "text-white/45 hover:text-white/75",
                )}
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="dataset-tab"
                    className="absolute inset-0 rounded-lg border border-[#f59e0b]/25 bg-[#f59e0b]/10"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "profile" && (
              <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <Panel className="overflow-hidden p-0">
                  {/* Dense forensic inventory header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.015] px-4 py-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Evidence inventory — {profile.columns.length} columns</span>
                    <span className="font-mono text-[11px] text-white/30">
                      {profile.row_count.toLocaleString("en-IN")} rows · {profile.duplicate_rows} dupes · {profile.candidate_keys.length} candidate key(s)
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="forensic-table min-w-[760px]">
                      <thead>
                        <tr>
                          <th>Column</th>
                          <th>Type</th>
                          <th>Nulls</th>
                          <th>Unique</th>
                          <th>Range / mean</th>
                          <th>Flags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.columns.map((col, i) => (
                          <motion.tr
                            key={col.name}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(i * 0.02, 0.4) }}
                          >
                            <td className="font-mono text-xs">
                              <span className="inline-flex items-center gap-1.5">
                                {col.name}
                                {profile.candidate_keys.some((k) => k.length === 1 && k[0] === col.name) && (
                                  <span title="candidate key" className="rounded bg-[#a78bfa]/15 px-1 py-px font-mono text-[9px] uppercase tracking-wide text-[#a78bfa]">
                                    key
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="font-mono text-xs text-white/45">{col.dtype}</td>
                            <td>
                              <span className="inline-flex items-center gap-2 font-mono text-xs tabular-nums text-white/55">
                                {(col.null_ratio * 100).toFixed(0)}% <NullBar ratio={col.null_ratio} />
                              </span>
                            </td>
                            <td className="font-mono text-xs tabular-nums text-white/55">{col.unique_count.toLocaleString("en-IN")}</td>
                            <td className="font-mono text-xs text-white/50">
                              {col.dtype.startsWith("Int") || col.dtype.startsWith("Float")
                                ? `${col.min ?? "?"} … ${col.max ?? "?"} (μ ${(col.mean ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })})`
                                : "—"}
                            </td>
                            <td>
                              {col.pii_hints.length > 0 ? (
                                <span
                                  className="inline-flex rounded-full border border-[#fb923c]/30 bg-[#fb923c]/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-[#fb923c]"
                                  title={col.pii_hints.map((h) => h.hint_type).join(", ")}
                                >
                                  PII · {col.pii_hints[0].hint_type.replace(/_/g, " ")}
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-white/20">—</span>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <p className="mt-2 text-center text-[11px] text-white/25">Profile is deterministic from byte hash + parser version — rerun reproduces identical columns.</p>
              </motion.div>
            )}

            {tab === "quality" && (
              <motion.div key="quality" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Quality observations · {profile.quality_observations.length}</span>
                  <span className="font-mono text-[11px] text-white/30">severity is the scan · description is the evidence</span>
                </div>
                {profile.quality_observations.map((obs, i) => (
                  <motion.div key={`${obs.code}-${obs.column}-${i}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
                    <Panel className="flex items-start justify-between gap-4 py-3.5">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-medium tracking-tight">{obs.code.replaceAll("_", " ")}</div>
                        <div className="mt-1 max-w-xl text-xs leading-relaxed text-white/45">{obs.description}</div>
                        {obs.column && <div className="mt-1.5 inline-flex rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-white/35">{obs.column}</div>}
                      </div>
                      <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider", SEV_CLASS[obs.severity])}>
                        {obs.severity}
                      </span>
                    </Panel>
                  </motion.div>
                ))}
                {!profile.quality_observations.length && (
                  <p className="panel p-8 text-center text-sm text-emerald-400/70">No quality issues detected by the profiler — clean evidence.</p>
                )}
              </motion.div>
            )}

            {tab === "lineage" && (
              <motion.div key="lineage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <Panel>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Evidence lineage — hash → profile → finding</h3>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-white/35">reproducible · pinned inputs</span>
                  </div>
                  {lineage ? <LineageViz graph={lineage} /> : <div className="flex justify-center py-10"><Spinner /></div>}
                  <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-white/40">
                    Every displayed claim traces back through <span className="font-mono text-white/60">parser → profile → rule → raw evidence</span>. Rerunning with the same pinned inputs reproduces this graph deterministically — audit by hash, not by trust.
                  </p>
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="order-1 space-y-4 lg:order-2">
          <Panel className="overflow-hidden p-0">
            <div className="p-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={cn(
                    "flex size-14 shrink-0 items-center justify-center rounded-xl border font-mono text-2xl font-bold",
                    ["A", "B"].includes(fitness.grade)
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                      : fitness.grade === "C"
                        ? "border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]"
                        : "border-[#fb923c]/30 bg-[#fb923c]/10 text-[#fb923c]",
                  )}
                  title={`Fitness score ${fitness.score}`}
                >
                  {fitness.grade}
                </div>
                <div>
                  <div className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{fitness.score.toFixed(1)}</div>
                  <div className="text-[11px] uppercase tracking-widest text-white/40">Data fitness</div>
                  <div className="font-mono text-[11px] text-white/30">{fitness.components.length} weighted signals</div>
                </div>
              </div>
              <ul className="mt-4 space-y-3">
                {fitness.components.map((comp) => (
                  <li key={comp.name}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="capitalize text-white/55">{comp.name.replaceAll("_", " ")}</span>
                      <span className="font-mono text-xs tabular-nums text-white/45">{comp.score.toFixed(0)}</span>
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
            </div>
            <div className="border-t border-white/[0.06] bg-white/[0.015] px-4 py-2.5 text-center text-[11px] text-white/30">Grade is not a verdict — read quality observations → lineage for context.</div>
          </Panel>

          <Panel className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Provenance — the evidence locator</h3>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-white/40">SHA-256</dt>
                <dd className="min-w-0 text-right">
                  <HashText hash={manifest.sha256} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/40">Source</dt>
                <dd className="font-mono text-white/75">{manifest.source.source_id}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/40">Size</dt>
                <dd className="font-mono text-white/60">{formatBytes(manifest.byte_size)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/40">Parser</dt>
                <dd className="font-mono text-white/60">
                  {manifest.parser.name}@{manifest.parser.version}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/40">Rows × cols</dt>
                <dd className="font-mono tabular-nums text-white/60">
                  {profile.row_count.toLocaleString("en-IN")} × {profile.column_count}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-white/40">Duplicates</dt>
                <dd className="font-mono tabular-nums text-white/60">{profile.duplicate_rows}</dd>
              </div>
              {manifest.release_date && (
                <div className="flex justify-between gap-3">
                  <dt className="text-white/40">Release</dt>
                  <dd className="font-mono text-white/60">{manifest.release_date}</dd>
                </div>
              )}
            </dl>
            <Link
              href="/compare"
              className="mt-4 block rounded-lg border border-dashed border-white/12 px-3 py-2.5 text-center text-xs text-white/55 transition hover:border-[#22d3ee]/30 hover:bg-[#22d3ee]/5 hover:text-[#22d3ee]"
            >
              Compare this dataset against another →
            </Link>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
