import type { FindingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<FindingStatus, string> = {
  open: "border-[var(--medium)]/30 bg-[var(--medium-soft)] text-[var(--medium)]",
  needs_source_clarification: "border-[var(--low)]/30 bg-[var(--low-soft)] text-[var(--low)]",
  resolved: "border-[var(--good)]/30 bg-[var(--good-soft)] text-[var(--good)]",
  not_detectable: "border-[var(--border-strong)] bg-[var(--background)] text-[var(--foreground-muted)]",
  false_positive_after_review: "border-[var(--critical)]/25 bg-[var(--critical-soft)] text-[var(--critical)]",
};

export const STATUS_LABEL: Record<FindingStatus, string> = {
  open: "Needs review",
  needs_source_clarification: "Waiting on source",
  resolved: "Checked, all good",
  not_detectable: "Can't tell from this data",
  false_positive_after_review: "Not a real problem",
};

export function StatusBadge({
  status,
  className,
}: {
  status: FindingStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        STYLES[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
