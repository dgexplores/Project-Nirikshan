"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowIcon } from "./PageChrome";
import { ErrorState } from "./ui/ErrorState";
import { Spinner } from "./ui/Spinner";
import { Panel } from "./ui/Panel";
import { getEvidence, type EvidenceResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Exact-location panel: the stored file rows behind a flag, with 1-based
 * row numbers, the measured column highlighted, and links onward to the
 * file page and the lineage-graph pinpoint.
 */
export function EvidenceRows({ findingId, datasetHref, graphHref }: { findingId: string; datasetHref: string; graphHref: string }) {
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvidence(findingId).then(setEvidence).catch((e: Error) => setError(e.message));
  }, [findingId]);

  if (error) {
    return (
      <Panel className="p-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Exact rows</h3>
        <ErrorState message={error} onRetry={() => setError(null)} />
      </Panel>
    );
  }
  if (!evidence) {
    return (
      <Panel className="flex justify-center p-4">
        <Spinner />
      </Panel>
    );
  }

  const sliceEntries = Object.entries(evidence.slice);
  const highlight = new Set<string>([...(evidence.metric ? [evidence.metric] : []), ...sliceEntries.map(([k]) => k)]);

  return (
    <Panel className="overflow-hidden p-0">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--foreground)]">Exact rows behind this flag</span>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--foreground-faint)]">{evidence.label}</p>
      </div>

      {evidence.note ? (
        <div className="space-y-3 p-4">
          <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">{evidence.note}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={datasetHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--background)]"
            >
              Open the file <ArrowIcon className="size-3.5" />
            </Link>
            <Link
              href={graphHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-3.5 py-2 text-sm font-medium text-[var(--brand)] transition hover:border-[var(--brand)]/45"
            >
              See the pinpoint on the graph <ArrowIcon className="size-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          {sliceEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] bg-[var(--background)] px-4 py-2.5">
              {sliceEntries.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full border border-[var(--brand)]/25 bg-white px-2.5 py-1 text-xs">
                  <span className="text-[var(--foreground-faint)]">{k}</span>
                  <span className="font-semibold text-[var(--foreground)]">{v}</span>
                </span>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">
                  <th className="px-4 py-2.5">Row</th>
                  {evidence.columns.map((c) => (
                    <th key={c} className="px-4 py-2.5">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evidence.rows.map((row, i) => (
                  <motion.tr
                    key={row._row}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.03, 0.4) }}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-4 py-2.5 tabular-nums font-semibold text-[var(--brand)]">{row._row}</td>
                    {evidence.columns.map((c) => (
                      <td key={c} className={cn("px-4 py-2.5 tabular-nums", highlight.has(c) ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground-muted)]")}>
                        {row[c] === null || row[c] === undefined ? <span className="text-[var(--foreground-faint)]">—</span> : String(row[c])}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-xs text-[var(--foreground-faint)]">
            <span>
              {evidence.matched.toLocaleString("en-IN")} matching row{evidence.matched === 1 ? "" : "s"}
              {evidence.truncated ? `, showing first ${evidence.returned}` : ""} · row numbers match the file
            </span>
            <span className="flex gap-2">
              <Link href={datasetHref} className="font-medium text-[var(--low)] hover:underline">Open file</Link>
              <Link href={graphHref} className="font-medium text-[var(--brand)] hover:underline">Pinpoint on graph</Link>
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}
