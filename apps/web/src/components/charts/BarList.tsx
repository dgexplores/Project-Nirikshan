"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface BarDatum {
  /** Stable id, also the filter value when the row is selectable. */
  key: string;
  label: string;
  value: number;
  /** Tailwind background class for the fill. Defaults to the brand hue. */
  fill?: string;
}

/**
 * Horizontal magnitude bars, one series, direct value labels.
 *
 * The label sits above its own bar rather than in a left gutter so long
 * dataset names stay readable instead of being truncated into ambiguity.
 * When `onSelect` is given each row becomes a filter control, so the chart
 * is a way to navigate the data rather than a picture beside it.
 */
export function BarList({
  data,
  onSelect,
  selected,
  emptyText = "Nothing to show yet",
  className,
}: {
  data: BarDatum[];
  onSelect?: (key: string) => void;
  selected?: string;
  emptyText?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (!data.length || total === 0) {
    return <p className={cn("text-sm text-[var(--foreground-muted)]", className)}>{emptyText}</p>;
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const share = total ? Math.round((d.value / total) * 100) : 0;
        const isSelected = selected === d.key;

        const row = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "truncate text-sm",
                  isSelected ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground-muted)]",
                )}
              >
                {d.label}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                {d.value.toLocaleString("en-IN")}
              </span>
            </span>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-[var(--background)]">
              <motion.span
                className={cn("block h-full rounded-full", d.fill ?? "bg-[var(--brand)]")}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.55, delay: Math.min(i * 0.04, 0.24), ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
          </>
        );

        return (
          <li key={d.key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(d.key)}
                aria-pressed={isSelected}
                title={`${d.label}: ${d.value} of ${total} (${share}%). Click to filter.`}
                className={cn(
                  "block w-full rounded-lg px-2 py-1.5 text-left transition",
                  isSelected ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--background)]",
                )}
              >
                {row}
              </button>
            ) : (
              <div className="px-2 py-1.5" title={`${d.label}: ${d.value} of ${total} (${share}%)`}>
                {row}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
