"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedNumber, formatBytes } from "@/components/AnimatedNumber";
import { OnboardingStepper } from "@/components/OnboardingStepper";
import { EvidenceMetaPill, PageHeader, StatCard } from "@/components/PageChrome";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { getDashboard, seedDemo, type DashboardSummary } from "@/lib/api";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

function severityDot(sev: string) {
  if (sev === "critical") return "bg-[#f87171]";
  if (sev === "high") return "bg-[#fb923c]";
  if (sev === "medium") return "bg-[#fbbf24]";
  if (sev === "low") return "bg-[#38bdf8]";
  return "bg-[#94a3b8]";
}

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
      setTimeout(() => document.getElementById("open-queue")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
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
  const openFindings = summary.recent_findings.filter((f) => f.status === "open");

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#22d3ee]" aria-hidden /> EVIDENCE LEDGER
            </span>
            <span className="text-white/20">·</span>
            <span>{summary.artifacts} artifacts</span>
            <span className="text-white/20">·</span>
            <span>{summary.findings_total} findings</span>
            <span className="text-white/20">·</span>
            <span className="text-[#f59e0b]">{summary.open_reviews} open requiring review</span>
          </>
        }
        title="Forensic dashboard"
        subtitle="Evidence-backed potential inconsistencies — every finding carries locators, hashes and a reproducible recipe. For human review, never a verdict."
        meta={
          <>
            <EvidenceMetaPill label="frozen bytes">{formatBytes(summary.bytes_total)}</EvidenceMetaPill>
            <EvidenceMetaPill label="rows under watch">{summary.rows_total.toLocaleString("en-IN")}</EvidenceMetaPill>
            {summary.avg_fitness !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">avg fitness</span>
                <span className="font-mono text-xs font-semibold text-white/80">{summary.avg_fitness.toFixed(1)}</span>
              </span>
            )}
          </>
        }
        actions={
          empty ? (
            <Button onClick={handleSeed} disabled={seeding}>
              {seeding ? <><Spinner className="size-3.5" /> Seeding demo…</> : "Load demo case"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleSeed} disabled={seeding} className="text-xs">
              {seeding ? <><Spinner className="size-3.5" /> Re-seeding…</> : "Re-seed demo"}
            </Button>
          )
        }
      />

      {/* HERO — Open findings requiring review: first viewport, dense */}
      <section id="open-queue" className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.015] px-4 py-3">
          <h2 className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-[#f59e0b]" aria-hidden />
              Open findings requiring review
            </span>
            <span className="rounded bg-[#f59e0b]/12 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#f59e0b] ring-1 ring-[#f59e0b]/20">
              {summary.open_reviews} open
            </span>
            <span className="hidden font-mono text-[11px] font-normal normal-case tracking-tight text-white/30 sm:inline">
              · severity scan → next action
            </span>
          </h2>
          <Link
            href="/findings?status=open"
            className="inline-flex items-center gap-1 rounded-full border border-[#f59e0b]/20 bg-[#f59e0b]/10 px-2.5 py-1 text-xs font-medium text-[#f59e0b] transition hover:bg-[#f59e0b]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]/40"
          >
            View queue <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="divide-y divide-white/[0.05]">
          <AnimatePresence initial={false}>
            {openFindings.slice(0, 7).map((finding, i) => (
              <motion.div
                key={finding.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035 }}
              >
                <Link
                  href={`/findings/${encodeURIComponent(finding.id)}`}
                  data-severity={finding.severity}
                  className="forensic-row group focus-visible:outline-none"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`mt-1.5 hidden size-2 shrink-0 rounded-full sm:inline-block ${severityDot(finding.severity)}`} aria-hidden />
                    <span className={`mt-0.5 size-1.5 shrink-0 rounded-full sm:hidden ${severityDot(finding.severity)}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium leading-tight group-hover:text-[#f59e0b]">{finding.title}</span>
                        <SeverityBadge severity={finding.severity as never} className="shrink-0 scale-90 sm:scale-100" />
                        <span className="hidden items-center gap-1 rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/40 sm:inline-flex">
                          {finding.kind}
                        </span>
                      </div>
                      <div className="mt-1 hidden truncate text-xs leading-relaxed text-white/40 sm:block">{finding.summary}</div>
                      <div className="mt-1.5 hidden flex-wrap items-center gap-1.5 sm:flex">
                        <span className="font-mono text-[11px] text-white/25">{finding.id.slice(0, 18)}…</span>
                        <span className="text-white/15">·</span>
                        <span className="font-mono text-[11px] text-white/30">{new Date(finding.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden rounded-full border border-[#f59e0b]/20 bg-[#f59e0b]/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-[#f59e0b] sm:inline-flex">
                      Review <span aria-hidden>→</span>
                    </span>
                    <span className="inline-flex size-7 items-center justify-center rounded-full border border-[#f59e0b]/20 bg-[#f59e0b]/10 text-[#f59e0b] sm:hidden" aria-hidden>
                      →
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>

          {!openFindings.length && (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto max-w-md">
                <div className="text-sm font-medium text-white/60">No open findings — queue is clear</div>
                <p className="mt-1.5 text-xs leading-relaxed text-white/35">
                  No findings match the current ledger. Ingest via <Link href="/datasets" className="text-[#22d3ee] underline decoration-white/15 underline-offset-2 hover:text-[#22d3ee]">Datasets</Link> or seed the demo corpus to populate the queue.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <Link href="/datasets" className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 hover:bg-white/[0.07]">Go to Datasets →</Link>
                  <button onClick={handleSeed} disabled={seeding} className="rounded-lg bg-[#f59e0b] px-3 py-1.5 text-xs font-semibold text-[#070b14] hover:bg-[#f59e0b]/90 disabled:opacity-60">
                    {seeding ? "Seeding…" : "Seed demo"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {summary.findings_total > 0 && openFindings.length === 0 && summary.recent_findings.length > 0 && (
            <div className="divide-y divide-white/[0.05]">
              {summary.recent_findings.slice(0, 4).map((f) => (
                <Link key={f.id} href={`/findings/${encodeURIComponent(f.id)}`} className="forensic-row opacity-60 hover:opacity-100">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{f.title}</div>
                    <div className="truncate text-xs text-white/35">{f.summary}</div>
                  </div>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase text-white/40">{f.status.replaceAll("_", " ")}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {summary.findings_total > openFindings.length && openFindings.length > 0 && (
          <div className="border-t border-white/[0.06] bg-white/[0.015] px-4 py-2.5 text-center text-xs text-white/35">
            {summary.findings_total - openFindings.length} more findings in queue ·{" "}
            <Link href="/findings" className="font-medium text-[#f59e0b] hover:underline">view all</Link>
          </div>
        )}
      </section>

      {empty && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
          <EmptyState
            icon="◈"
            title="No artifacts yet — start with evidence"
            hint="Click 'Load demo case' to seed 6 artifacts + 20 findings, or drop your own CSV in Datasets. Next: review the queue above, then Ask in Hindi/English."
          />
        </motion.div>
      )}

      {/* Compact stats – secondary row */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Artifacts" variant="compact" delay={0.04} hint="frozen · SHA-256">
          <span className="text-white"><AnimatedNumber value={summary.artifacts} /></span>
        </StatCard>
        <StatCard label="Rows under watch" variant="compact" delay={0.08} hint={`${formatBytes(summary.bytes_total)} frozen`}>
          <span className="text-[#22d3ee]"><AnimatedNumber value={summary.rows_total} /></span>
        </StatCard>
        <StatCard label="Open findings" variant="compact" delay={0.12} hint={`${summary.open_reviews} awaiting review`}>
          <span className="text-[#f59e0b]"><AnimatedNumber value={summary.findings_total} /></span>
        </StatCard>
        <StatCard label="Avg fitness" variant="compact" delay={0.16} hint="A–F · weighted">
          {summary.avg_fitness !== null ? (
            <span className="text-white/80"><AnimatedNumber value={summary.avg_fitness} decimals={1} /></span>
          ) : (
            <span className="text-white/30">—</span>
          )}
        </StatCard>
      </div>

      {/* Secondary density: severity scan + by engine */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="panel p-4"
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/45">Findings by severity — scan priority</h2>
          <div className="mt-3.5 space-y-2.5">
            {SEVERITY_ORDER.map((sev, i) => {
              const count = summary.by_severity[sev] ?? 0;
              return (
                <div key={sev} className="flex items-center gap-3">
                  <div className="w-20 shrink-0">
                    <SeverityBadge severity={sev as (typeof SEVERITY_ORDER)[number]} />
                  </div>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / sevTotal) * 100}%` }}
                      transition={{ duration: 0.65, delay: 0.22 + i * 0.05 }}
                      className={`h-full rounded-full ${sev === "critical" ? "bg-[#f87171]" : sev === "high" ? "bg-[#fb923c]" : sev === "medium" ? "bg-[#fbbf24]" : sev === "low" ? "bg-[#38bdf8]" : "bg-[#94a3b8]"}`}
                    />
                  </div>
                  <span className="w-8 text-right font-mono text-xs tabular-nums text-white/60">{count}</span>
                </div>
              );
            })}
          </div>

          <h2 className="mt-6 text-[11px] font-semibold uppercase tracking-widest text-white/45">By engine</h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {Object.entries(summary.by_kind).map(([kind, count], i) => (
              <motion.span
                key={kind}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.32 + i * 0.04 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs"
              >
                <span className="capitalize text-white/70">{kind}</span>
                <span className="font-mono text-xs font-semibold text-[#22d3ee]">{count}</span>
              </motion.span>
            ))}
            {!Object.keys(summary.by_kind).length && <span className="text-xs text-white/30">No findings yet</span>}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="panel p-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/45">Recent artifacts — frozen lineage</h2>
            <Link href="/datasets" className="text-xs font-medium text-[#22d3ee]/80 hover:text-[#22d3ee]">View all →</Link>
          </div>
          <div className="mt-3 divide-y divide-white/[0.05] rounded-lg border border-white/[0.06] bg-white/[0.015]">
            {summary.recent_artifacts.slice(0, 5).map((art, i) => (
              <motion.div key={art.artifact_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }}>
                <Link
                  href={`/datasets/${encodeURIComponent(art.artifact_id)}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 transition hover:bg-white/[0.02] group"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium group-hover:text-[#f59e0b]">{art.title || art.artifact_id}</div>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-white/35">
                      <span className="truncate">{art.artifact_id}</span>
                      <span className="hidden text-white/20 sm:inline">·</span>
                      <span className="hidden sm:inline">{art.row_count !== null ? `${art.row_count.toLocaleString("en-IN")} rows` : "—"}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {art.fitness_grade ? (
                      <span
                        className={`inline-flex size-7 items-center justify-center rounded-md border font-mono text-xs font-bold ${["A", "B"].includes(art.fitness_grade) ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : art.fitness_grade === "C" ? "border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]" : "border-[#fb923c]/30 bg-[#fb923c]/10 text-[#fb923c]"}`}
                      >
                        {art.fitness_grade}
                      </span>
                    ) : (
                      <span className="size-7 rounded-md border border-white/10 bg-white/5" />
                    )}
                    <span className="hidden text-white/20 sm:inline" aria-hidden>→</span>
                  </div>
                </Link>
              </motion.div>
            ))}
            {!summary.recent_artifacts.length && (
              <div className="px-3 py-6 text-center text-xs text-white/30">No artifacts — seed demo or ingest first.</div>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/30">Each artifact is immutable: SHA-256 + parser version + profile frozen at ingest.</p>
        </motion.section>
      </div>

      {/* Stepper – secondary, integrated */}
      <div id="how-it-works" className="mt-6">
        <OnboardingStepper artifacts={summary.artifacts} findings={summary.findings_total} />
      </div>

      <footer className="mt-8 border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-white/30">
        BDD identifies <em className="not-italic text-white/45">potential</em> inconsistencies for review. It does not declare a source, dataset, or person wrong — high/critical requires human confirmation before external sharing.
      </footer>
    </div>
  );
}
