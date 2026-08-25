"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PageHeader } from "@/components/PageChrome";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { listFindings, type FindingsParams } from "@/lib/api";
import type { UnifiedFinding } from "@/lib/types";

const KINDS = ["", "anomaly", "contradiction", "drift", "consensus", "benford"];
const SEVERITIES = ["", "critical", "high", "medium", "low", "info"];
const STATUSES = ["", "open", "needs_source_clarification", "resolved", "not_detectable", "false_positive_after_review"];

const KIND_ICON: Record<string, string> = {
  anomaly: "📈",
  contradiction: "⚡",
  drift: "🔀",
  consensus: "🧬",
  benford: "🎲",
};

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
      <PageHeader
        title="Findings queue"
        subtitle={`${total} finding(s) matching filters. Each carries evidence refs and a reproducible recipe — review before acting.`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by severity"
          value={params.severity ?? ""}
          onChange={(e) => update({ severity: e.target.value || undefined })}
          className="w-auto text-xs"
        >
          {SEVERITIES.map((s) => (
            <option key={s || "all"} value={s}>{s ? `Severity: ${s}` : "All severities"}</option>
          ))}
        </Select>
        <Select
          aria-label="Filter by engine"
          value={params.kind ?? ""}
          onChange={(e) => update({ kind: e.target.value || undefined })}
          className="w-auto text-xs"
        >
          {KINDS.map((k) => (
            <option key={k || "all"} value={k}>{k ? `Engine: ${k}` : "All engines"}</option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={params.status ?? ""}
          onChange={(e) => update({ status: e.target.value || undefined })}
          className="w-auto text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>{s ? s.replaceAll("_", " ") : "All statuses"}</option>
          ))}
        </Select>
        {(params.severity || params.kind || params.status) && (
          <button
            onClick={() => setParams({})}
            className="text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
          >
            clear
          </button>
        )}
      </div>

      {!items ? (
        <div className="flex justify-center py-24"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((finding, i) => (
              <motion.div
                key={finding.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
              >
                <Link
                  href={`/findings/${encodeURIComponent(finding.id)}`}
                  className={`panel group block p-4 transition hover:border-[#f59e0b]/40 ${
                    finding.severity === "high" || finding.severity === "critical" ? "border-l-2 border-l-[#fb923c]" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 text-lg opacity-60" aria-hidden>{KIND_ICON[finding.kind] ?? "•"}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-medium group-hover:text-[#f59e0b]">{finding.title}</h3>
                          <SeverityBadge severity={finding.severity} />
                          {finding.status !== "open" && (
                            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/50">
                              {finding.status.replaceAll("_", " ")}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 max-w-3xl text-xs leading-relaxed text-white/45">{finding.summary}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-white/35">
                          {finding.artifact_ids.map((aid) => (
                            <span key={aid} className="rounded bg-white/[0.05] px-1.5 py-px">{aid}</span>
                          ))}
                          <span>conf {finding.confidence}</span>
                        </div>
                      </div>
                    </div>
                    <time className="shrink-0 text-[11px] text-white/30" dateTime={finding.created_at}>
                      {new Date(finding.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </time>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
          {!items.length && (
            <EmptyState
              icon="🗂"
              title="No findings match these filters"
              hint="Ingest datasets, run a comparison, or load the demo corpus from the dashboard."
            />
          )}
        </div>
      )}
    </div>
  );
}
