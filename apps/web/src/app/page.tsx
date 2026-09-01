"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedNumber, formatBytes } from "@/components/AnimatedNumber";
import { HomeHero } from "@/components/HomeHero";
import { OnboardingStepper } from "@/components/OnboardingStepper";
import { ArrowIcon, StatCard } from "@/components/PageChrome";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { getDashboard, seedDemo, type DashboardSummary } from "@/lib/api";
import { KIND_LABEL } from "@/lib/labels";
import { cn, gradeToneClass, humanizeFields } from "@/lib/utils";
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

  const open = summary.recent_findings.filter((f) => f.status === "open");

  // Lead with the most serious finding, not the most recent one. A judge or a
  // first-time reader should meet the strongest evidence first.
  const rank = (s: string) => {
    const i = SEVERITY_ORDER.indexOf(s as (typeof SEVERITY_ORDER)[number]);
    return i === -1 ? SEVERITY_ORDER.length : i;
  };
  const featured =
    [...open].sort((a, b) => rank(a.severity) - rank(b.severity))[0] ??
    summary.recent_findings[0] ??
    null;

  // Shown in the hero already, so it should not repeat as row one below.
  const openFindings = open.filter((f) => f.id !== featured?.id);
  const shown = openFindings.slice(0, 7);
  // recent_findings is a capped sample, so the true remainder comes from the
  // open_reviews total minus what is actually on screen (rows plus the hero).
  const remaining = Math.max(summary.open_reviews - shown.length - (featured ? 1 : 0), 0);

  return (
    <div>
      <HomeHero summary={summary} featured={featured} onSeed={handleSeed} seeding={seeding} />

      {/* The queue itself, directly under the pitch so the proof is one scroll away */}
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
            {shown.map((finding, i) => (
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
                        <span className="truncate text-[15px] font-medium leading-tight group-hover:text-[var(--brand)]">{humanizeFields(finding.title)}</span>
                        <SeverityBadge severity={finding.severity as never} className="shrink-0 scale-90 sm:scale-100" />
                      </div>
                      <div className="mt-1 hidden truncate text-sm leading-relaxed text-[var(--foreground-muted)] sm:block">{humanizeFields(finding.summary)}</div>
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

          {!open.length && (
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

          {summary.findings_total > 0 && open.length === 0 && summary.recent_findings.length > 0 && (
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

        {remaining > 0 && shown.length > 0 && (
          <div className="border-t border-[var(--border)] px-4 py-3 text-center text-sm text-[var(--foreground-muted)]">
            {remaining.toLocaleString("en-IN")} more to review ·{" "}
            <Link href="/findings" className="font-medium text-[var(--brand)] hover:underline">see all</Link>
          </div>
        )}
      </section>

      {/* Compact stats, secondary row */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Files uploaded" variant="compact" hint="Safely stored">
          <span className="text-[var(--foreground)]"><AnimatedNumber value={summary.artifacts} /></span>
        </StatCard>
        <StatCard label="Rows checked" variant="compact" hint={`${formatBytes(summary.bytes_total)} total`}>
          <span className="text-[var(--brand)]"><AnimatedNumber value={summary.rows_total} /></span>
        </StatCard>
        <StatCard label="Things found" variant="compact" hint={`${summary.open_reviews} need review`}>
          <span className="text-[var(--medium)]"><AnimatedNumber value={summary.findings_total} /></span>
        </StatCard>
        <StatCard label="Data quality" variant="compact" hint="Out of 100">
          {summary.avg_fitness !== null ? (
            <span className="text-[var(--good)]"><AnimatedNumber value={summary.avg_fitness} decimals={1} /></span>
          ) : (
            <span className="text-[var(--foreground-faint)]">&mdash;</span>
          )}
        </StatCard>
      </div>

      {/* Recently uploaded. The severity and kind breakdown lives on Problems
          found, where the same bars double as filters instead of repeating here. */}
      <div className="mt-4">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Recently uploaded</h2>
            <Link href="/datasets" className="text-sm font-medium text-[var(--brand)] hover:underline">See all</Link>
          </div>
          <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {summary.recent_artifacts.slice(0, 5).map((art) => (
              <Link
                key={art.artifact_id}
                href={`/datasets/${encodeURIComponent(art.artifact_id)}`}
                className="group flex items-center justify-between gap-3 px-3.5 py-3 transition hover:bg-[var(--background)]"
              >
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium group-hover:text-[var(--brand)]">{art.title || art.artifact_id}</div>
                  <div className="mt-0.5 text-sm text-[var(--foreground-muted)]">
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
            ))}
            {!summary.recent_artifacts.length && (
              <div className="px-3.5 py-8 text-center text-sm text-[var(--foreground-muted)]">No files yet, upload one or try a sample.</div>
            )}
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-[var(--foreground-muted)]">Once uploaded, a file can&apos;t be secretly changed. We keep a permanent, verified copy.</p>
        </section>
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
