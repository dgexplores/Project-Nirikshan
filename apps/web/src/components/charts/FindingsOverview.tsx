"use client";

import { BarList, type BarDatum } from "@/components/charts/BarList";
import { SEVERITY_DOT_CLASS } from "@/components/ui/SeverityBadge";
import { KIND_LABEL } from "@/lib/labels";
import { fileLabel } from "@/lib/utils";
import type { Severity, UnifiedFinding } from "@/lib/types";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

function countBy<T>(items: T[], key: (item: T) => string | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

/**
 * Three read-at-a-glance breakdowns of whatever the filters currently select:
 * how serious, what kind, and which file. The first two double as filters.
 */
export function FindingsOverview({
  items,
  severity,
  kind,
  onSeverity,
  onKind,
  showFiles = true,
}: {
  items: UnifiedFinding[];
  severity?: string;
  kind?: string;
  onSeverity: (value: string) => void;
  onKind: (value: string) => void;
  /** Hidden when the view is already scoped to one file, where a
   *  single-bar chart would say nothing the filter chip has not. */
  showFiles?: boolean;
}) {
  const bySeverity = countBy(items, (f) => f.severity);
  const severityData: BarDatum[] = SEVERITY_ORDER.filter((s) => (bySeverity.get(s) ?? 0) > 0).map((s) => ({
    key: s,
    label: SEVERITY_LABEL[s] ?? s,
    value: bySeverity.get(s) ?? 0,
    fill: SEVERITY_DOT_CLASS[s],
  }));

  const byKind = countBy(items, (f) => f.kind);
  const kindData: BarDatum[] = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, value]) => ({ key: k, label: KIND_LABEL[k] ?? k, value }));

  const byFile = countBy(items.flatMap((f) => f.artifact_ids ?? []), (id) => id);
  const fileData: BarDatum[] = [...byFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, value]) => ({ key: id, label: fileLabel(id), value }));

  return (
    <section className="panel mb-4 p-5" aria-label="Breakdown of the problems shown below">
      <div className={`grid gap-6 lg:gap-8 ${showFiles ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">How serious are they?</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-faint)]">
            Click a bar to see only those.
          </p>
          <BarList
            className="mt-3"
            data={severityData}
            selected={severity}
            onSelect={(key) => onSeverity(key === severity ? "" : key)}
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">What kind of problem?</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-faint)]">
            Each kind is a different check we ran.
          </p>
          <BarList
            className="mt-3"
            data={kindData}
            selected={kind}
            onSelect={(key) => onKind(key === kind ? "" : key)}
          />
        </div>

        {showFiles && (
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Which file has the most?</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-faint)]">
              Where the problems are concentrated.
            </p>
            <BarList className="mt-3" data={fileData} emptyText="No files linked yet" />
          </div>
        )}
      </div>
    </section>
  );
}
