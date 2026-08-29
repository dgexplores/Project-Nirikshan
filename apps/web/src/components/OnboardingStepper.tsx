"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, title: "Upload", desc: "Drop a CSV/XLSX", href: "/datasets", cta: "Go to Datasets" },
  { n: 2, title: "Review", desc: "Check flagged findings", href: "/findings", cta: "Open Findings" },
  { n: 3, title: "Ask", desc: "Ask in Hindi or English", href: "/ask", cta: "Ask Detective" },
];

export function OnboardingStepper({ artifacts, findings }: { artifacts: number; findings: number }) {
  const active = artifacts === 0 ? 0 : findings === 0 ? 1 : 2;
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">How it works — 3 steps</h3>
        <span className="rounded-full bg-white/[0.06] px-2 py-1 font-mono text-[10px] text-white/40">Step {active + 1} of 3</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => {
          const done = i < active;
          const isActive = i === active;
          return (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "relative rounded-xl border p-4 transition",
                isActive ? "border-[#f59e0b]/40 bg-[#f59e0b]/10" : done ? "border-emerald-400/20 bg-emerald-400/5" : "border-white/10 bg-white/[0.02]"
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("flex size-7 items-center justify-center rounded-full text-xs font-bold", isActive ? "bg-[#f59e0b] text-[#070b14]" : done ? "bg-emerald-400 text-[#070b14]" : "bg-white/10 text-white/60")}>
                  {done ? "✓" : s.n}
                </span>
                <span className="text-sm font-medium">{s.title}</span>
                {isActive && <span className="ml-auto size-2 animate-pulse rounded-full bg-[#f59e0b]" aria-hidden />}
              </div>
              <p className="mt-2 text-xs text-white/50">{s.desc}</p>
              <Link href={s.href} className={cn("mt-3 inline-flex rounded-lg px-3 py-1.5 text-xs font-medium transition", isActive ? "bg-white text-[#070b14] hover:bg-white/90" : "border border-white/15 text-white/70 hover:bg-white/[0.06]")}>
                {s.cta} →
              </Link>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-white/30">You are here → highlighted step. Click any card to jump.</p>
    </div>
  );
}

export function HelpBanner({ title, desc, href, cta }: { title: string; desc: string; href: string; cta: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#22d3ee]/20 bg-[#22d3ee]/10 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-[#22d3ee]">{title}</div>
        <div className="text-xs text-white/60">{desc}</div>
      </div>
      <Link href={href} className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-[#070b14] hover:bg-[#22d3ee]/90">
        {cta} →
      </Link>
    </div>
  );
}
