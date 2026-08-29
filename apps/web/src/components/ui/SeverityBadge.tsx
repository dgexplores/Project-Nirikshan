import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<Severity, string> = {
  info: "text-[var(--info)] border-[var(--info)]/25 bg-[var(--info-soft)]",
  low: "text-[var(--low)] border-[var(--low)]/25 bg-[var(--low-soft)]",
  medium: "text-[var(--medium)] border-[var(--medium)]/25 bg-[var(--medium-soft)]",
  high: "text-[var(--high)] border-[var(--high)]/25 bg-[var(--high-soft)]",
  critical: "text-[var(--critical)] border-[var(--critical)]/25 bg-[var(--critical-soft)]",
};

export const SEVERITY_DOT_CLASS: Record<Severity, string> = {
  info: "bg-[var(--info)]",
  low: "bg-[var(--low)]",
  medium: "bg-[var(--medium)]",
  high: "bg-[var(--high)]",
  critical: "bg-[var(--critical)]",
};

// Plain-language read on how serious each level is, shown as a tooltip.
const HINTS: Record<Severity, string> = {
  info: "Just for your information",
  low: "Small, probably not urgent",
  medium: "Worth a look",
  high: "Should check soon",
  critical: "Check this first",
};

const LABELS: Record<Severity, string> = {
  info: "Info",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      title={HINTS[severity]}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        STYLES[severity],
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", SEVERITY_DOT_CLASS[severity])} />
      {LABELS[severity]}
    </span>
  );
}
