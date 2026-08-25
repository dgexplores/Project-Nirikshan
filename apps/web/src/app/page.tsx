"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedNumber, formatBytes } from "@/components/AnimatedNumber";
import { PageHeader, StatCard } from "@/components/PageChrome";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { getDashboard, seedDemo, type DashboardSummary } from "@/lib/api";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(() => {
    getDashboard()
      .then(setSummary)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function handleSeed() {
    setSeeding(true);
    try {
      await seedDemo();
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!summary) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner />
      </div>
    );
  }

  const empty = summary.artifacts === 0;
  const sevTotal = Math.max(
    SEVERITY_ORDER.reduce((acc, s) => acc + (summary.by_severity[s] ?? 0), 0),
    1,
  );

  return (
    <div>
      <PageHeader
        title="Forensic dashboard"
        subtitle="Evidence-backed potential inconsistencies across public data. Findings are for human review — never verdicts."
        actions={
          empty ? (
            <Button onClick={handleSeed} disabled={seeding}>
              {seeding ? <><Spinner className="size-3.5" /> Seeding demo…</> : "Load demo case"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleSeed} disabled={seeding}>
              {seeding ? <><Spinner className="size-3.5" /> Re-seeding…</> : "Re-seed demo"}
            </Button>
          )
        }
      />

      {empty && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
          <EmptyState
            icon="🔍"
            title="No artifacts yet"
            hint="Load the synthetic demo corpus to explore a full forensic case, or upload your own datasets."
          />
        </motion.div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Artifacts" delay={0}>
          <AnimatedNumber value={summary.artifacts} />
        </StatCard>
        <StatCard label="Rows under watch" delay={0.06} hint={`${formatBytes(summary.bytes_total)} frozen`}>
          <AnimatedNumber value={summary.rows_total} />
        </StatCard>
        <StatCard label="Open findings" delay={0.12} hint={`${summary.open_reviews} awaiting review`}>
          <span className="text-[#f59e0b]">
            <AnimatedNumber value={summary.findings_total} />
          </span>
        </StatCard>
        <StatCard label="Avg fitness" delay={0.18}>
          {summary.avg_fitness !== null ? (
            <AnimatedNumber value={summary.avg_fitness} decimals={1} />
          ) : (
            <span className="text-white/30">—</span>
          )}
        </StatCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="panel p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Findings by severity</h2>
          <div className="mt-4 space-y-3">
            {SEVERITY_ORDER.map((sev, i) => {
              const count = summary.by_severity[sev] ?? 0;
              return (
                <div key={sev} className="flex items-center gap-3">
                  <div className="w-20 shrink-0">
                    <SeverityBadge severity={sev as (typeof SEVERITY_ORDER)[number]} />
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / sevTotal) * 100}%` }}
                      transition={{ duration: 0.7, delay: 0.25 + i * 0.07 }}
                      className={`h-full rounded-full ${
                        sev === "critical" ? "bg-[#f87171]" :
                        sev === "high" ? "bg-[#fb923c]" :
                        sev === "medium" ? "bg-[#fbbf24]" :
                        sev === "low" ? "bg-[#38bdf8]" : "bg-[#94a3b8]"
                      }`}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-sm tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-white/50">By engine</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(summary.by_kind).map(([kind, count], i) => (
              <motion.span
                key={kind}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs"
              >
                <span className="capitalize">{kind}</span>
                <span className="ml-2 font-mono font-semibold text-[#22d3ee]">{count}</span>
              </motion.span>
            ))}
            {!Object.keys(summary.by_kind).length && <span className="text-sm text-white/30">No findings yet</span>}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="panel p-5"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Latest findings</h2>
          <ul className="mt-4 space-y-2.5">
            <AnimatePresence initial={false}>
              {summary.recent_findings.map((finding, i) => (
                <motion.li
                  key={finding.id}
                  layout
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={`/findings/${encodeURIComponent(finding.id)}`}
                    className="group flex items-start gap-3 rounded-lg border border-transparent p-2.5 transition hover:border-white/10 hover:bg-white/[0.03]"
                  >
                    <SeverityBadge severity={finding.severity as never} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium group-hover:text-[#f59e0b]">{finding.title}</div>
                      <div className="truncate text-xs text-white/40">{finding.summary}</div>
                    </div>
                    <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] uppercase text-white/45">
                      {finding.status === "open" ? "review" : finding.status.replace(/_/g, " ")}
                    </span>
                  </Link>
                </motion.li>
              ))}
            </AnimatePresence>
            {!summary.recent_findings.length && (
              <li className="py-6 text-center text-sm text-white/30">Nothing yet — run a comparison or seed the demo.</li>
            )}
          </ul>
        </motion.section>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34 }}
        className="panel mt-6 p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">Recent artifacts</h2>
          <Link href="/datasets" className="text-xs text-[#22d3ee]/80 hover:text-[#22d3ee]">
            View all →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summary.recent_artifacts.map((art, i) => (
            <motion.div
              key={art.artifact_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.06 }}
            >
              <Link href={`/datasets/${encodeURIComponent(art.artifact_id)}`} className="panel block p-4 transition hover:border-[#f59e0b]/40">
                <div className="truncate text-sm font-medium">{art.title || art.artifact_id}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
                  {art.row_count !== null && <span>{art.row_count.toLocaleString("en-IN")} rows</span>}
                  {art.fitness_grade && (
                    <span className={`font-mono font-bold ${
                      ["A", "B"].includes(art.fitness_grade) ? "text-emerald-400" :
                      art.fitness_grade === "C" ? "text-[#fbbf24]" : "text-[#fb923c]"
                    }`}>{art.fitness_grade}</span>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <footer className="mt-10 border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-white/30">
        BDD identifies evidence-backed potential inconsistencies for review. It does not declare a source,
        dataset, or person wrong.
      </footer>
    </div>
  );
}
