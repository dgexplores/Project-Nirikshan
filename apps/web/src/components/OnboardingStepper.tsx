"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowIcon, CheckIcon } from "@/components/PageChrome";

const STEPS = [
  { n: 1, title: "Upload a file", desc: "We save a safe, verified copy", href: "/datasets", cta: "Your files" },
  { n: 2, title: "See what looks off", desc: "Check each one, decide what to do", href: "/findings", cta: "Problems found" },
  { n: 3, title: "Ask a question", desc: "Get an answer with proof, in Hindi or English", href: "/ask", cta: "Ask" },
];

export function OnboardingStepper({ artifacts, findings }: { artifacts: number; findings: number }) {
  const active = artifacts === 0 ? 0 : findings === 0 ? 1 : 2;
  return (
    <div className="panel px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">How it works</h3>
        <span className="rounded-full bg-[var(--background)] px-2.5 py-1 text-xs text-[var(--foreground-muted)]">Step {active + 1} of 3</span>
      </div>
      <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => {
          const done = i < active;
          const isActive = i === active;
          return (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3.5 py-3 transition",
                isActive ? "border-[var(--brand)]/30 bg-[var(--brand-soft)]" : done ? "border-[var(--good)]/20 bg-[var(--good-soft)]" : "border-[var(--border)] bg-white",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  isActive ? "bg-[var(--brand)] text-white" : done ? "bg-[var(--good)] text-white" : "bg-[var(--background)] text-[var(--foreground-muted)]",
                )}
              >
                {done ? <CheckIcon className="size-4" /> : s.n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium leading-none">{s.title}</span>
                  {isActive && <span className="size-1.5 animate-pulse rounded-full bg-[var(--brand)]" aria-hidden />}
                </div>
                <div className="mt-1 truncate text-xs leading-none text-[var(--foreground-muted)]">{s.desc}</div>
              </div>
              <Link
                href={s.href}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition",
                  isActive ? "bg-[var(--foreground)] text-white hover:opacity-90" : "border border-[var(--border)] text-[var(--foreground-muted)] hover:bg-[var(--background)]",
                )}
              >
                {s.cta} <ArrowIcon className="size-3" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function HelpBanner({ title, desc, href, cta }: { title: string; desc: string; href: string; cta: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--low)]/20 bg-[var(--low-soft)] px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--low)]">{title}</div>
        <div className="mt-0.5 text-sm leading-relaxed text-[var(--foreground-muted)]">{desc}</div>
      </div>
      <Link
        href={href}
        className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--low)] px-3.5 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--low)]/40"
      >
        {cta} <ArrowIcon className="size-3.5" />
      </Link>
    </div>
  );
}
