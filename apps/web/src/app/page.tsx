"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedNumber, formatBytes } from "@/components/AnimatedNumber";
import { OnboardingStepper } from "@/components/OnboardingStepper";
import { ArrowIcon, PageHeader, StatCard } from "@/components/PageChrome";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { getDashboard, seedDemo, type DashboardSummary } from "@/lib/api";
import { KIND_LABEL } from "@/lib/labels";
import { cn, gradeToneClass } from "@/lib/utils";
import { SEVERITY_DOT_CLASS } from "@/components/ui/SeverityBadge";
import type { Severity } from "@/lib/types";

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
            <span>{summary.artifacts} files uploaded</span>
            <span className="text-[var(--foreground-faint)]">·</span>
            <span>{summary.findings_total} things found</span>
            <span className="text-[var(--foreground-faint)]">·</span>
            <span className="font-semibold text-[var(--medium)]">{summary.open_reviews} need your review</span>
          </>
        }
        title="Your overview"
        subtitle="We check your uploaded data for problems and show you exactly why. Nothing here is a final answer, you always decide what to do next."
        actions={
          empty ? (
            <Button onClick={handleSeed} disabled={seeding}>
              {seeding ? <><Spinner className="size-3.5" /> Loading a sample…</> : "Try a sample"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleSeed} disabled={seeding} className="text-sm">
              {seeding ? <><Spinner className="size-3.5" /> Loading…</> : "Load sample data"}
            </Button>
          )
        }
      />

      {/* Hero: problems that need review, first thing you see */}
      <section id="open-queue" className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5 sm:px-5">
          <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
            Problems that need your review
            <span className="rounded-full bg-[var(--medium-soft)] px-2 py-0.5 text-sm font-bold text-[var(--medium)]">
              {summary.open_reviews}
            </span>
          </h2>
          <Link
            href="/findings?status=open"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/30"
          >
            See all <ArrowIcon className="size-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-[var(--border)]">
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
                  className="item-row group focus-visible:outline-none"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${SEVERITY_DOT_CLASS[finding.severity as Severity]}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[15px] font-medium leading-tight group-hover:text-[var(--brand)]">{finding.title}</span>
                        <SeverityBadge severity={finding.severity as never} className="shrink-0 scale-90 sm:scale-100" />
                      </div>
                      <div className="mt-1 hidden truncate text-sm leading-relaxed text-[var(--foreground-muted)] sm:block">{finding.summary}</div>
                      <div className="mt-1.5 hidden flex-wrap items-center gap-1.5 text-xs text-[var(--foreground-faint)] sm:flex">
                        <span>{KIND_LABEL[finding.kind] ?? finding.kind}</span>
                        <span>·</span>
                        <span>{new Date(finding.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="row-action hidden items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--foreground)] sm:inline-flex">
                      Review <ArrowIcon className="size-3.5" />
                    </span>
                    <span className="row-action inline-flex size-8 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground-muted)] sm:hidden" aria-hidden>
                      <ArrowIcon className="size-4" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>

          {!openFindings.length && (
            <div className="px-4 py-12 text-center">
              <div className="text-[15px] font-medium text-[var(--foreground)]">Nothing needs your review right now</div>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--foreground-muted)]">
                Upload a file in <Link href="/datasets" className="font-medium text-[var(--brand)] hover:underline">Your files</Link>, or try a sample so you can see how this works.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/datasets" className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)]">
                  Go to your files <ArrowIcon className="size-3.5" />
                </Link>
                <button onClick={handleSeed} disabled={seeding} className="rounded-full bg-[var(--brand)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60">
                  {seeding ? "Loading…" : "Try a sample"}
                </button>
              </div>
            </div>
          )}

          {summary.findings_total > 0 && openFindings.length === 0 && summary.recent_findings.length > 0 && (
            <div className="divide-y divide-[var(--border)]">
              {summary.recent_findings.slice(0, 4).map((f) => (
                <Link key={f.id} href={`/findings/${encodeURIComponent(f.id)}`} className="item-row opacity-70 hover:opacity-100">
                  <div className="min-w-0">
                    <div className="truncate text-[15px]">{f.title}</div>
                    <div className="truncate text-sm text-[var(--foreground-muted)]">{f.summary}</div>
                  </div>
                  <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--foreground-muted)]">{f.status.replaceAll("_", " ")}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {summary.findings_total > openFindings.length && openFindings.length > 0 && (
          <div className="border-t border-[var(--border)] px-4 py-3 text-center text-sm text-[var(--foreground-muted)]">
            {summary.findings_total - openFindings.length} more to review ·{" "}
            <Link href="/findings" className="font-medium text-[var(--brand)] hover:underline">see all</Link>
          </div>
        )}
      </section>

      {empty && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
          <EmptyState
            icon={<ArrowIcon className="size-5" />}
            title="No files yet, let's start with one"
            hint="Click 'Try a sample' to see 6 files and 20 things we found, or upload your own file in Your files. Next, look at what we found, then try asking a question."
          />
        </motion.div>
      )}

      {/* Compact stats, secondary row */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Files uploaded" variant="compact" delay={0.04} hint="Safely stored">
          <span className="text-[var(--foreground)]"><AnimatedNumber value={summary.artifacts} /></span>
        </StatCard>
        <StatCard label="Rows checked" variant="compact" delay={0.08} hint={`${formatBytes(summary.bytes_total)} total`}>
          <span className="text-[var(--brand)]"><AnimatedNumber value={summary.rows_total} /></span>
        </StatCard>
        <StatCard label="Things found" variant="compact" delay={0.12} hint={`${summary.open_reviews} need review`}>
          <span className="text-[var(--medium)]"><AnimatedNumber value={summary.findings_total} /></span>
        </StatCard>
        <StatCard label="Data quality" variant="compact" delay={0.16} hint="Out of 100">
          {summary.avg_fitness !== null ? (
            <span className="text-[var(--good)]"><AnimatedNumber value={summary.avg_fitness} decimals={1} /></span>
          ) : (
            <span className="text-[var(--foreground-faint)]">—</span>
          )}
        </StatCard>
      </div>

      {/* Secondary density: severity scan + by engine */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="panel p-5"
        >
          <h2 className="text-sm font-semibold text-[var(--foreground)]">How serious are they?</h2>
          <div className="mt-3.5 space-y-2.5">
            {SEVERITY_ORDER.map((sev, i) => {
              const count = summary.by_severity[sev] ?? 0;
              return (
                <div key={sev} className="flex items-center gap-3">
                  <div className="w-20 shrink-0">
                    <SeverityBadge severity={sev as (typeof SEVERITY_ORDER)[number]} />
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--background)]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / sevTotal) * 100}%` }}
                      transition={{ duration: 0.65, delay: 0.22 + i * 0.05 }}
                      className={`h-full rounded-full ${SEVERITY_DOT_CLASS[sev as Severity]}`}
                    />
                  </div>
                  <span className="w-8 text-right text-sm tabular-nums text-[var(--foreground-muted)]">{count}</span>
                </div>
              );
            })}
          </div>

          <h2 className="mt-6 text-sm font-semibold text-[var(--foreground)]">What kind of problem</h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {Object.entries(summary.by_kind).map(([kind, count], i) => (
              <motion.span
                key={kind}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.32 + i * 0.04 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm"
              >
                <span className="text-[var(--foreground-muted)]">{KIND_LABEL[kind] ?? kind}</span>
                <span className="font-semibold text-[var(--brand)]">{count}</span>
              </motion.span>
            ))}
            {!Object.keys(summary.by_kind).length && <span className="text-sm text-[var(--foreground-faint)]">Nothing found yet</span>}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="panel p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Recently uploaded</h2>
            <Link href="/datasets" className="text-sm font-medium text-[var(--brand)] hover:underline">See all</Link>
          </div>
          <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {summary.recent_artifacts.slice(0, 5).map((art, i) => (
              <motion.div key={art.artifact_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.05 }}>
                <Link
                  href={`/datasets/${encodeURIComponent(art.artifact_id)}`}
                  className="flex items-center justify-between gap-3 px-3.5 py-3 transition hover:bg-[var(--background)] group"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium group-hover:text-[var(--brand)]">{art.title || art.artifact_id}</div>
                    <div className="mt-0.5 text-sm text-[var(--foreground-faint)]">
                      {art.row_count !== null ? `${art.row_count.toLocaleString("en-IN")} rows` : "Checking…"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {art.fitness_grade ? (
                      <span
                        className={cn("inline-flex size-8 items-center justify-center rounded-lg border text-sm font-bold", gradeToneClass(art.fitness_grade))}
                      >
                        {art.fitness_grade}
                      </span>
                    ) : (
                      <span className="size-8 rounded-lg border border-[var(--border)] bg-[var(--background)]" />
                    )}
                    <ArrowIcon className="size-4 text-[var(--foreground-faint)]" />
                  </div>
                </Link>
              </motion.div>
            ))}
            {!summary.recent_artifacts.length && (
              <div className="px-3.5 py-8 text-center text-sm text-[var(--foreground-faint)]">No files yet, upload one or try a sample.</div>
            )}
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-[var(--foreground-faint)]">Once uploaded, a file can&apos;t be secretly changed. We keep a permanent, verified copy.</p>
        </motion.section>
      </div>

      {/* Stepper, secondary, integrated */}
      <div id="how-it-works" className="mt-6">
        <OnboardingStepper artifacts={summary.artifacts} findings={summary.findings_total} />
      </div>

      <footer className="mt-8 border-t border-[var(--border)] pt-4 text-sm leading-relaxed text-[var(--foreground-faint)]">
        We point out things worth double-checking. We never decide who or what is right, that&apos;s always your call.
      </footer>
    </div>
  );
}
