"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, title: "Upload", desc: "Drop CSV/XLSX · frozen & hashed", href: "/datasets", cta: "Datasets" },
  { n: 2, title: "Review", desc: "Scan severity → set decision", href: "/findings", cta: "Findings" },
  { n: 3, title: "Ask", desc: "Hindi/English · cited or refused", href: "/ask", cta: "Ask" },
];

export function OnboardingStepper({ artifacts, findings }: { artifacts: number; findings: number }) {
  const active = artifacts === 0 ? 0 : findings === 0 ? 1 : 2;
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">How BDD works — 3 steps</h3>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-white/40">Step {active + 1} of 3 · you are here →</span>
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
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
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition",
                isActive ? "border-[#f59e0b]/30 bg-[#f59e0b]/10" : done ? "border-emerald-400/15 bg-emerald-400/5" : "border-white/8 bg-white/[0.015]",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isActive ? "bg-[#f59e0b] text-[#070b14]" : done ? "bg-emerald-400 text-[#070b14]" : "bg-white/10 text-white/55",
                )}
              >
                {done ? "✓" : s.n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium leading-none">{s.title}</span>
                  {isActive && <span className="size-1.5 animate-pulse rounded-full bg-[#f59e0b]" aria-hidden />}
                </div>
                <div className="mt-0.5 truncate text-[11px] leading-none text-white/45">{s.desc}</div>
              </div>
              <Link
                href={s.href}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                  isActive ? "bg-white text-[#070b14] hover:bg-white/90" : "border border-white/12 text-white/60 hover:bg-white/[0.06]",
                )}
              >
                {s.cta} →
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
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border-l-2 border-l-[#22d3ee] border-y border-r border-white/[0.07] bg-[#22d3ee]/[0.06] px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-[#22d3ee]">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-white/50">{desc}</div>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-full bg-[#22d3ee] px-3 py-1 text-xs font-semibold text-[#070b14] transition hover:bg-[#22d3ee]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/40"
      >
        {cta} →
      </Link>
    </div>
  );
}
