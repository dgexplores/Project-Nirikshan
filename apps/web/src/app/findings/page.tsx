"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Breadcrumb } from "@/components/Breadcrumb";
import { HelpBanner } from "@/components/OnboardingStepper";
import { PageHeader } from "@/components/PageChrome";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { listFindings, type FindingsParams } from "@/lib/api";
import type { UnifiedFinding } from "@/lib/types";

const KINDS = ["", "anomaly", "contradiction", "drift", "consensus", "benford"];
const SEVERITIES = ["", "critical", "high", "medium", "low", "info"];
const STATUSES = ["", "open", "needs_source_clarification", "resolved", "not_detectable", "false_positive_after_review"];

function severityAccent(sev: string) {
  if (sev === "critical") return "border-l-[#f87171]";
  if (sev === "high") return "border-l-[#fb923c]";
  if (sev === "medium") return "border-l-[#fbbf24]";
  if (sev === "low") return "border-l-[#38bdf8]";
  return "border-l-white/15";
}

export default function FindingsPage() {
  const [items, setItems] = useState<UnifiedFinding[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<FindingsParams>({ status: "open" });

  const load = useCallback(() => {
    listFindings(params)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total ?? res.items.length);
      })
      .catch((e: Error) => setError(e.message));
  }, [params]);

  useEffect(load, [load]);

  function update(patch: Partial<FindingsParams>) {
    setParams((prev) => ({ ...prev, ...patch }));
  }

  if (error && !items) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Findings" }]} />
      <PageHeader
        eyebrow={
          <>
            <span className="text-[#f59e0b]">REVIEW QUEUE</span>
            <span className="text-white/20">·</span>
            <span>{total} finding(s) matching filters</span>
            <span className="hidden text-white/20 sm:inline">·</span>
            <span className="hidden sm:inline">severity + evidence → next action</span>
          </>
        }
        title="Findings queue"
        subtitle="Each finding carries evidence refs, a reproducible recipe and a lineage. Review before acting — BDD never declares a source wrong."
        meta={
          items ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs">
                <span className="size-1.5 rounded-full bg-[#f59e0b]" aria-hidden /> {items.length} in view
              </span>
              <span className="hidden font-mono text-[11px] text-white/30 sm:inline">locators: artifact_id · SHA refs · evidence query</span>
            </>
          ) : undefined
        }
      />
      <HelpBanner
        title="Review flow — click row → read evidence vs expected → set decision → auto-returns"
        desc="Filter by severity/engine to focus. Start with high/critical. Secondary metadata collapses at 390px — severity + Review preserved."
        href="/datasets"
        cta="Datasets"
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select aria-label="Filter by severity" value={params.severity ?? ""} onChange={(e) => update({ severity: e.target.value || undefined })} className="w-auto text-xs">
          {SEVERITIES.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? `Severity: ${s}` : "All severities"}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by engine" value={params.kind ?? ""} onChange={(e) => update({ kind: e.target.value || undefined })} className="w-auto text-xs">
          {KINDS.map((k) => (
            <option key={k || "all"} value={k}>
              {k ? `Engine: ${k}` : "All engines"}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by status" value={params.status ?? ""} onChange={(e) => update({ status: e.target.value || undefined })} className="w-auto text-xs">
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? s.replaceAll("_", " ") : "All statuses"}
            </option>
          ))}
        </Select>
        {(params.severity || params.kind || params.status) && (
          <button onClick={() => setParams({})} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45 transition hover:bg-white/[0.04] hover:text-white/70">
            Clear filters
          </button>
        )}
        <span className="ml-auto hidden font-mono text-[11px] text-white/25 sm:inline">dense rows · severity is primary scan</span>
      </div>

      {!items ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {/* Column header – desktop only */}
          <div className="hidden grid-cols-[96px_1fr_118px_96px] items-center gap-2 border-b border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/30 sm:grid sm:px-4">
            <span>Severity · engine</span>
            <span>Finding · evidence preview</span>
            <span className="text-right">Evidence locators</span>
            <span className="text-right">Next action</span>
          </div>

          <div className="divide-y divide-white/[0.05]">
            <AnimatePresence initial={false}>
              {items.map((finding, i) => (
                <motion.div
                  key={finding.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.35) }}
                >
                  <Link
                    href={`/findings/${encodeURIComponent(finding.id)}`}
                    className={`group flex items-stretch gap-0 border-l-2 bg-transparent transition hover:bg-white/[0.022] focus-visible:outline-none sm:grid sm:grid-cols-[96px_1fr_118px_96px] sm:gap-2 sm:px-0 ${severityAccent(finding.severity)}`}
                  >
                    {/* Severity + engine – primary scan, always visible */}
                    <span className="flex shrink-0 items-start gap-2 px-3 py-3 sm:px-4">
                      <SeverityBadge severity={finding.severity} className="shrink-0" />
                      <span className="hidden flex-col gap-1 sm:flex">
                        <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/40">{finding.kind}</span>
                        {finding.status !== "open" && (
                          <span className="rounded-full border border-white/12 px-1.5 py-0.5 text-center font-mono text-[10px] uppercase tracking-wide text-white/35">
                            {finding.status.replaceAll("_", " ").slice(0, 18)}
                          </span>
                        )}
                      </span>
                    </span>

                    {/* Finding body – title + summary + inline meta (summary hidden at 390) */}
                    <span className="min-w-0 flex-1 px-0 py-3 pr-2 sm:py-3">
                      <span className="block truncate pr-2 text-sm font-medium leading-tight group-hover:text-[#f59e0b] sm:pr-0">{finding.title}</span>
                      <span className="mt-1 hidden line-clamp-1 text-xs leading-relaxed text-white/40 sm:block">{finding.summary}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="hidden font-mono text-[11px] text-white/25 sm:inline">{finding.id.slice(0, 20)}…</span>
                        <span className="hidden text-white/15 sm:inline">·</span>
                        <span className="font-mono text-[11px] text-white/30">conf {finding.confidence}</span>
                        <span className="text-white/15">·</span>
                        <span className="font-mono text-[11px] text-white/30">{new Date(finding.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                        <span className="inline-flex rounded bg-[#f59e0b]/10 px-1 py-px font-mono text-[10px] uppercase tracking-wide text-[#f59e0b] sm:hidden">
                          {finding.kind}
                        </span>
                      </span>
                    </span>

                    {/* Evidence locators – inline artifacts, collapses to count at 390 */}
                    <span className="hidden min-w-0 flex-col items-end justify-center gap-1 px-2 py-3 sm:flex">
                      <span className="flex max-w-full flex-wrap justify-end gap-1">
                        {finding.artifact_ids.slice(0, 2).map((aid) => (
                          <span key={aid} className="max-w-[11ch] truncate rounded border border-white/8 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-white/40">
                            {aid}
                          </span>
                        ))}
                        {finding.artifact_ids.length > 2 && (
                          <span className="rounded bg-white/5 px-1 py-0.5 font-mono text-[10px] text-white/30">+{finding.artifact_ids.length - 2}</span>
                        )}
                      </span>
                      <span className="font-mono text-[10px] text-white/20">{finding.artifact_ids.length} locator(s)</span>
                    </span>

                    {/* Next action – always preserved */}
                    <span className="flex shrink-0 items-center gap-2 self-center px-3 sm:justify-end sm:px-4">
                      <span className="hidden items-center gap-1 rounded-full border border-[#f59e0b]/20 bg-[#f59e0b]/10 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-[#f59e0b] transition group-hover:bg-[#f59e0b]/15 sm:inline-flex">
                        Review <span aria-hidden>→</span>
                      </span>
                      <span className="inline-flex size-7 items-center justify-center rounded-full border border-[#f59e0b]/20 bg-[#f59e0b]/10 text-sm text-[#f59e0b] sm:hidden" aria-hidden>
                        →
                      </span>
                    </span>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {!items.length && (
            <div className="px-4 py-10 text-center">
              <div className="text-sm font-medium text-white/60">No findings match — ingest via Datasets or seed demo</div>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-white/35">
                Try clearing filters, ingesting a dataset in{" "}
                <Link href="/datasets" className="text-[#22d3ee] underline decoration-white/15 underline-offset-2 hover:text-[#22d3ee]">
                  Datasets
                </Link>{" "}
                or seeding the demo corpus from the{" "}
                <Link href="/" className="text-[#22d3ee] underline decoration-white/15 underline-offset-2 hover:text-[#22d3ee]">
                  dashboard
                </Link>{" "}
                to populate the queue.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/datasets" className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.04]">
                  Go to Datasets →
                </Link>
                <button
                  onClick={() => setParams({})}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#070b14] hover:bg-white/90"
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {items && items.length > 0 && <p className="mt-2 text-center text-[11px] text-white/25">Tip: severity + evidence locator are the primary scan — click any row for full lineage &amp; delta.</p>}
    </div>
  );
}
