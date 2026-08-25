import type { Confidence } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<Confidence, string> = {
  low: "border-white/20 text-slate-400",
  moderate: "border-[#22d3ee]/40 text-[#22d3ee]",
  high: "border-emerald-400/40 text-emerald-400",
};

const LABELS: Record<Confidence, string> = {
  low: "Low confidence",
  moderate: "Moderate confidence",
  high: "High confidence",
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
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STYLES[confidence],
        className,
      )}
    >
      {LABELS[confidence]}
    </span>
  );
}
