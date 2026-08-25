import type { FindingStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<FindingStatus, string> = {
  open: "border-amber-400/40 bg-amber-400/10 text-amber-400",
  needs_source_clarification:
    "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
  resolved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
  not_detectable: "border-white/15 bg-white/5 text-slate-400",
  false_positive_after_review: "border-rose-400/40 bg-rose-400/10 text-rose-300",
};

const LABELS: Record<FindingStatus, string> = {
  open: "Open",
  needs_source_clarification: "Needs source clarification",
  resolved: "Resolved",
  not_detectable: "Not detectable",
  false_positive_after_review: "False positive",
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
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
