import type { Confidence } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<Confidence, string> = {
  low: "border-[var(--border-strong)] text-[var(--foreground-muted)]",
  moderate: "border-[var(--low)]/35 text-[var(--low)]",
  high: "border-[var(--good)]/35 text-[var(--good)]",
};

const LABELS: Record<Confidence, string> = {
  low: "Not very sure",
  moderate: "Fairly sure",
  high: "Very sure",
};

export function ConfidencePill({
  confidence,
  className,
}: {
  confidence: Confidence;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        STYLES[confidence],
        className,
      )}
    >
      {LABELS[confidence]}
    </span>
  );
}
