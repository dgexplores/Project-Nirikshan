import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<Severity, string> = {
  info: "text-[#94a3b8] border-[#94a3b8]/40 bg-[#94a3b8]/10",
  low: "text-[#38bdf8] border-[#38bdf8]/40 bg-[#38bdf8]/10",
  medium: "text-[#fbbf24] border-[#fbbf24]/40 bg-[#fbbf24]/10",
  high: "text-[#fb923c] border-[#fb923c]/40 bg-[#fb923c]/10",
  critical: "text-[#f87171] border-[#f87171]/40 bg-[#f87171]/10",
};

const DOTS: Record<Severity, string> = {
  info: "bg-[#94a3b8]",
  low: "bg-[#38bdf8]",
  medium: "bg-[#fbbf24]",
  high: "bg-[#fb923c]",
  critical: "bg-[#f87171]",
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
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[severity],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", DOTS[severity])}
      />
      {LABELS[severity]}
    </span>
  );
}
