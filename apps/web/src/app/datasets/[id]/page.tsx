"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { formatBytes } from "@/components/AnimatedNumber";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ArrowIcon, HashText, PageHeader } from "@/components/PageChrome";
import { LineageViz } from "@/components/LineageViz";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { analyzeArtifact, getFinding, getFitness, getLineage, getManifest, getProfile } from "@/lib/api";
import type { DatasetProfile, FitnessScore, LineageGraph, Manifest } from "@/lib/types";
import { cn, gradeToneClass } from "@/lib/utils";

type Tab = "profile" | "quality" | "lineage";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Columns" },
  { id: "quality", label: "Quality checks" },
  { id: "lineage", label: "Where this came from" },
];

function NullBar({ ratio }: { ratio: number }) {
  return (
    <span className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-[var(--background)] align-middle">
      <motion.span
        initial={{ width: 0 }}
        animate={{ width: `${ratio * 100}%` }}
        transition={{ duration: 0.6 }}
        className={`block h-full rounded-full ${ratio > 0.5 ? "bg-[var(--high)]" : ratio > 0 ? "bg-[var(--medium)]" : "bg-[var(--good)]"}`}
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
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);

  // Deep link from a finding: ?tab=lineage&finding=<row id> opens the graph
  // with that finding's node highlighted. Read client-side so the static
  // build never needs a Suspense boundary for search params.
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("tab") === "lineage" || qs.get("finding")) setTab("lineage");
    const fid = qs.get("finding");
    if (fid) {
      getFinding(fid)
        .then((f) => {
          const inner = (f.payload as { finding_id?: string } | null)?.finding_id;
          setHighlightId(inner ? `finding:${inner}` : null);
        })
        .catch(() => setHighlightId(null));
    }
  }, []);

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
      setAnalyzeMsg(`Found ${res.findings_written} new thing(s) to review`);
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
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Your files", href: "/datasets" }, { label: manifest.source.official_title || id }]} />
      <PageHeader
        eyebrow={<HashText hash={manifest.sha256} />}
        title={manifest.source.official_title || manifest.artifact_id}
        subtitle={`Uploaded ${new Date(manifest.retrieved_at).toLocaleString("en-IN")} · from ${manifest.source.source_id} · ${profile.row_count.toLocaleString("en-IN")} rows, ${profile.column_count} columns · ${formatBytes(manifest.byte_size)}`}
        meta={
          manifest.release_date ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm">
              <span className="text-[var(--foreground-faint)]">Time period</span> <span className="font-medium">{manifest.release_date}</span>
            </span>
          ) : undefined
        }
        actions={
          <>
            <Link
              href={`/findings?file=${encodeURIComponent(id)}`}
              className="hidden rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] sm:inline-flex"
            >
              See this file&apos;s problems
            </Link>
            <Button variant="ghost" onClick={handleAnalyze} disabled={analyzing} className="text-sm">
              {analyzing ? <><Spinner className="size-3.5" /> Checking…</> : "Check again"}
            </Button>
          </>
        }
      />
      {analyzeMsg && (
        <p className="mb-4 rounded-xl border border-[var(--low)]/25 bg-[var(--low-soft)] px-3.5 py-2.5 text-sm text-[var(--low)]">{analyzeMsg}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_324px]">
        <div className="order-2 space-y-4 lg:order-1">
          <div role="tablist" aria-label="Dataset sections" className="flex gap-1 rounded-xl border border-[var(--border)] bg-white p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex-1 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none",
                  tab === t.id ? "text-white" : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
                )}
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="dataset-tab"
                    className="absolute inset-0 rounded-lg bg-[var(--brand)]"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>

          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {tab === "profile" && (
              <div>
                <Panel className="overflow-hidden p-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                    <span className="text-sm font-semibold text-[var(--foreground)]">{profile.columns.length} columns</span>
                    <span className="text-sm text-[var(--foreground-faint)]">
                      {profile.row_count.toLocaleString("en-IN")} rows · {profile.duplicate_rows} duplicate{profile.duplicate_rows === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--background)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                          <th className="px-4 py-2.5">Column</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Missing</th>
                          <th className="px-4 py-2.5">Unique</th>
                          <th className="px-4 py-2.5">Range / average</th>
                          <th className="px-4 py-2.5">Flags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.columns.map((col, i) => (
                          <motion.tr
                            key={col.name}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(i * 0.02, 0.4) }}
                            className="border-b border-[var(--border)] last:border-0"
                          >
                            <td className="px-4 py-3 font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                {col.name}
                                {profile.candidate_keys.some((k) => k.length === 1 && k[0] === col.name) && (
                                  <span title="This column can uniquely identify a row" className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand)]">
                                    key
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[var(--foreground-muted)]">{col.dtype}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-2 tabular-nums text-[var(--foreground-muted)]">
                                {(col.null_ratio * 100).toFixed(0)}% <NullBar ratio={col.null_ratio} />
                              </span>
                            </td>
                            <td className="px-4 py-3 tabular-nums text-[var(--foreground-muted)]">{col.unique_count.toLocaleString("en-IN")}</td>
                            <td className="px-4 py-3 text-[var(--foreground-muted)]">
                              {col.dtype.startsWith("Int") || col.dtype.startsWith("Float")
                                ? `${col.min ?? "?"} – ${col.max ?? "?"} (avg ${(col.mean ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })})`
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {col.pii_hints.length > 0 ? (
                                <span
                                  className="inline-flex rounded-full border border-[var(--high)]/25 bg-[var(--high-soft)] px-2 py-0.5 text-xs font-medium text-[var(--high)]"
                                  title={col.pii_hints.map((h) => h.hint_type).join(", ")}
                                >
                                  Personal info
                                </span>
                              ) : (
                                <span className="text-[var(--foreground-faint)]">—</span>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <p className="mt-2 text-center text-sm text-[var(--foreground-faint)]">This never changes for the same file, checking again gives the same columns.</p>
              </div>
            )}

            {tab === "quality" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-[var(--foreground)]">{profile.quality_observations.length} quality check{profile.quality_observations.length === 1 ? "" : "s"}</span>
                </div>
                {profile.quality_observations.map((obs, i) => (
                  <motion.div key={`${obs.code}-${obs.column}-${i}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
                    <Panel className="flex items-start justify-between gap-4 py-3.5">
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium">{obs.description}</div>
                        {obs.column && <div className="mt-1.5 inline-flex rounded bg-[var(--background)] px-1.5 py-0.5 text-xs text-[var(--foreground-muted)]">{obs.column}</div>}
                      </div>
                      <SeverityBadge severity={obs.severity} className="shrink-0" />
                    </Panel>
                  </motion.div>
                ))}
                {!profile.quality_observations.length && (
                  <p className="panel p-10 text-center text-sm text-[var(--good)]">No quality issues found, this file looks clean.</p>
                )}
              </div>
            )}

            {tab === "lineage" && (
              <div>
                <Panel>
                  <h3 className="mb-1 text-sm font-semibold text-[var(--foreground)]">Where this came from</h3>
                  {highlightId && (
                    <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--critical)]/25 bg-[var(--critical-soft)] px-3 py-1 text-xs font-medium text-[var(--critical)]">
                      <span className="inline-block size-2 rounded-full bg-[var(--critical)]" aria-hidden />
                      Glowing node is the flag you came from
                    </p>
                  )}
                  {lineage ? <LineageViz graph={lineage} highlightId={highlightId} /> : <div className="flex justify-center py-10"><Spinner /></div>}
                </Panel>
              </div>
            )}
          </motion.div>
        </div>

        <aside className="order-1 space-y-4 lg:order-2">
          <Panel className="overflow-hidden p-0">
            <div className="p-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={cn(
                    "flex size-14 shrink-0 items-center justify-center rounded-xl border text-2xl font-bold",
                    gradeToneClass(fitness.grade),
                  )}
                  title={`Quality score ${fitness.score}`}
                >
                  {fitness.grade}
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums tracking-tight">{fitness.score.toFixed(0)}/100</div>
                  <div className="text-sm text-[var(--foreground-muted)]">Data quality</div>
                </div>
              </div>
              <ul className="mt-4 space-y-3">
                {fitness.components.map((comp) => (
                  <li key={comp.name}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="capitalize text-[var(--foreground-muted)]">{comp.name.replaceAll("_", " ")}</span>
                      <span className="tabular-nums text-[var(--foreground-muted)]">{comp.score.toFixed(0)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--background)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${comp.score}%` }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className={`h-full rounded-full ${comp.score >= 75 ? "bg-[var(--good)]" : comp.score >= 50 ? "bg-[var(--medium)]" : "bg-[var(--high)]"}`}
                      />
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--foreground-faint)]">{comp.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-center text-xs text-[var(--foreground-faint)]">A grade is a helpful signal, not a final answer, check the details above.</div>
          </Panel>

          <Panel className="p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">File details</h3>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-[var(--foreground-muted)]">Verified copy</dt>
                <dd className="min-w-0 text-right">
                  <HashText hash={manifest.sha256} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--foreground-muted)]">Source</dt>
                <dd className="text-[var(--foreground)]">{manifest.source.source_id}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--foreground-muted)]">Size</dt>
                <dd className="text-[var(--foreground)]">{formatBytes(manifest.byte_size)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--foreground-muted)]">Rows × columns</dt>
                <dd className="tabular-nums text-[var(--foreground)]">
                  {profile.row_count.toLocaleString("en-IN")} × {profile.column_count}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--foreground-muted)]">Duplicate rows</dt>
                <dd className="tabular-nums text-[var(--foreground)]">{profile.duplicate_rows}</dd>
              </div>
              {manifest.release_date && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--foreground-muted)]">Time period</dt>
                  <dd className="text-[var(--foreground)]">{manifest.release_date}</dd>
                </div>
              )}
            </dl>
            <Link
              href="/compare"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-2.5 text-center text-sm text-[var(--foreground-muted)] transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
            >
              Compare with another file <ArrowIcon className="size-3.5" />
            </Link>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
