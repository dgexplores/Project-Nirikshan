"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowIcon, PageHeader } from "@/components/PageChrome";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { FindingsOverview } from "@/components/charts/FindingsOverview";
import { listFindings, type FindingsParams } from "@/lib/api";
import { KIND_LABEL } from "@/lib/labels";
import { fileLabel, humanizeFields } from "@/lib/utils";
import { STATUS_LABEL } from "@/components/ui/StatusBadge";
import type { UnifiedFinding } from "@/lib/types";

const KINDS = ["", "anomaly", "contradiction", "drift", "consensus", "benford"];
const SEVERITIES = ["", "critical", "high", "medium", "low", "info"];
const STATUSES = ["", "open", "needs_source_clarification", "resolved", "not_detectable", "false_positive_after_review"];

export default function FindingsPage() {
  const [items, setItems] = useState<UnifiedFinding[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<FindingsParams>({ status: "open" });
  // Set when arriving from a file, as /findings?file=<artifact_id>. Read off
  // the URL directly rather than useSearchParams, which would require wrapping
  // this statically prerendered page in a Suspense boundary.
  const [fileId, setFileId] = useState("");

  useEffect(() => {
    setFileId(new URLSearchParams(window.location.search).get("file") ?? "");
  }, []);

  const load = useCallback(() => {
    // The breakdown above the list aggregates these rows, so pull the full
    // matching set (API caps at 500) rather than a first page of 100.
    listFindings({ ...params, limit: 500 })
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

  const visible = fileId
    ? (items ?? []).filter((f) => f.artifact_ids?.includes(fileId))
    : items;
  const shownTotal = fileId ? (visible?.length ?? 0) : total;

  return (
    <div>
      <PageHeader
        title="Problems found"
        subtitle={`${shownTotal.toLocaleString("en-IN")} match your filters. Every one comes with proof so you can check it yourself. We never say who's right, you decide.`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select aria-label="Filter by how serious" value={params.severity ?? ""} onChange={(e) => update({ severity: e.target.value || undefined })} className="w-auto text-sm">
          {SEVERITIES.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? `How serious: ${s}` : "Any seriousness"}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by type" value={params.kind ?? ""} onChange={(e) => update({ kind: e.target.value || undefined })} className="w-auto text-sm">
          {KINDS.map((k) => (
            <option key={k || "all"} value={k}>
              {k ? `Type: ${KIND_LABEL[k] ?? k}` : "Any type"}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by status" value={params.status ?? ""} onChange={(e) => update({ status: e.target.value || undefined })} className="w-auto text-sm">
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? (STATUS_LABEL as Record<string, string>)[s] ?? s.replaceAll("_", " ") : "Any status"}
            </option>
          ))}
        </Select>
        {fileId && (
          <button
            onClick={() => {
              setFileId("");
              window.history.replaceState(null, "", "/findings");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand)]/30 bg-[var(--brand-soft)] px-3 py-1.5 text-sm font-medium text-[var(--brand)]"
          >
            File: {fileLabel(fileId)}
            <span aria-hidden>&times;</span>
            <span className="sr-only">Clear the file filter</span>
          </button>
        )}
        {(params.severity || params.kind || params.status) && (
          <button onClick={() => setParams({})} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground-muted)] transition hover:bg-[var(--background)]">
            Clear filters
          </button>
        )}
      </div>

      {visible && visible.length > 0 && (
        <FindingsOverview
          items={visible}
          severity={params.severity}
          kind={params.kind}
          onSeverity={(v) => update({ severity: v || undefined })}
          onKind={(v) => update({ kind: v || undefined })}
          showFiles={!fileId}
        />
      )}

      {!visible ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            <AnimatePresence initial={false}>
              {visible.map((finding, i) => (
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
                    data-severity={finding.severity}
                    className="item-row group focus-visible:outline-none"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <SeverityBadge severity={finding.severity} className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium leading-tight group-hover:text-[var(--brand)]">{humanizeFields(finding.title)}</span>
                        <span className="mt-1 hidden line-clamp-1 text-sm leading-relaxed text-[var(--foreground-muted)] sm:block">{humanizeFields(finding.summary)}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--foreground-faint)]">
                          <span>{KIND_LABEL[finding.kind] ?? finding.kind}</span>
                          <span>·</span>
                          <span>{new Date(finding.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                          {finding.status !== "open" && (
                            <>
                              <span>·</span>
                              <span>{STATUS_LABEL[finding.status] ?? finding.status.replaceAll("_", " ")}</span>
                            </>
                          )}
                        </span>
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
          </div>

          {!visible.length && (
            <div className="px-4 py-14 text-center">
              <div className="text-[15px] font-medium text-[var(--foreground)]">Nothing matches these filters</div>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
                Try clearing the filters, uploading a file in{" "}
                <Link href="/datasets" className="font-medium text-[var(--brand)] hover:underline">
                  Your files
                </Link>{" "}
                or trying a sample from the{" "}
                <Link href="/" className="font-medium text-[var(--brand)] hover:underline">
                  overview
                </Link>.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/datasets" className="rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)]">
                  Go to your files
                </Link>
                <button
                  onClick={() => setParams({})}
                  className="rounded-full bg-[var(--brand)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
                >
                  Clear filters
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
