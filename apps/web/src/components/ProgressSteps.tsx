"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, string> = {
  done: "✓",
  running: "◐",
  failed: "✕",
  pending: "·",
};

export function ProgressSteps({ job }: { job: Job }) {
  const pct = Math.round(job.progress);
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="font-mono uppercase tracking-wider text-white/50">
          {job.kind} · {job.status}
        </span>
        <motion.span
          key={pct}
          initial={{ scale: 1.25 }}
          animate={{ scale: 1 }}
          className="font-mono font-semibold text-[#f59e0b]"
        >
          {pct}%
        </motion.span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className={cn(
            "h-full rounded-full",
            job.status === "failed" ? "bg-[#f87171]" : "bg-gradient-to-r from-[#22d3ee] to-[#f59e0b]",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${job.status === "done" ? 100 : pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      <ul className="mt-3 space-y-1.5">
        <AnimatePresence initial={false}>
          {job.steps.map((step) => (
            <motion.li
              key={step.name}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-xs"
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block w-4 text-center font-mono",
                  step.status === "done" && "text-emerald-400",
                  step.status === "running" && "animate-pulse text-[#f59e0b]",
                  step.status === "failed" && "text-[#f87171]",
                  step.status === "pending" && "text-white/25",
                )}
              >
                {ICONS[step.status] ?? "·"}
              </span>
              <span
                className={cn(
                  "font-mono",
                  step.status === "pending" ? "text-white/30" : "text-white/70",
                )}
              >
                {step.name.replaceAll("_", " ")}
              </span>
              {step.detail && (
                <span className="truncate text-white/35">{step.detail}</span>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
