"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CheckIcon } from "@/components/PageChrome";

const STEP_LABELS: Record<string, string> = {
  receive_upload: "Receiving your file",
  parse: "Reading the file",
  freeze_manifest: "Saving a safe copy",
  profile: "Checking quality",
  fitness: "Scoring quality",
  persist: "Almost done",
};

function friendlyStep(name: string): string {
  return STEP_LABELS[name] ?? name.replaceAll("_", " ");
}

export function ProgressSteps({ job }: { job: Job }) {
  const pct = Math.round(job.progress);
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium text-[var(--foreground-muted)]">
          {job.status === "failed" ? "Something went wrong" : job.status === "done" ? "All done" : "Working on it…"}
        </span>
        <motion.span
          key={pct}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="font-semibold text-[var(--brand)]"
        >
          {pct}%
        </motion.span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--background)]">
        <motion.div
          className={cn(
            "h-full rounded-full",
            job.status === "failed" ? "bg-[var(--critical)]" : "bg-[var(--brand)]",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${job.status === "done" ? 100 : pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      <ul className="mt-3.5 space-y-2">
        <AnimatePresence initial={false}>
          {job.steps.map((step) => (
            <motion.li
              key={step.name}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2.5 text-sm"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full",
                  step.status === "done" && "bg-[var(--good-soft)] text-[var(--good)]",
                  step.status === "running" && "bg-[var(--brand-soft)] text-[var(--brand)]",
                  step.status === "failed" && "bg-[var(--critical-soft)] text-[var(--critical)]",
                  step.status === "pending" && "bg-[var(--background)] text-[var(--foreground-faint)]",
                )}
              >
                {step.status === "done" && <CheckIcon className="size-3" />}
                {step.status === "running" && <span className="size-2 animate-pulse rounded-full bg-current" />}
                {step.status === "failed" && <span className="text-xs leading-none">!</span>}
                {step.status === "pending" && <span className="size-1 rounded-full bg-current" />}
              </span>
              <span
                className={cn(
                  step.status === "pending" ? "text-[var(--foreground-faint)]" : "text-[var(--foreground)]",
                )}
              >
                {friendlyStep(step.name)}
              </span>
              {step.detail && (
                <span className="truncate text-[var(--foreground-faint)]">{step.detail}</span>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
