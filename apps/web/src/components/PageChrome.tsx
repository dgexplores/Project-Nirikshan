"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5">
      {eyebrow && (
        <div className="evidence-eyebrow mb-2 flex flex-wrap items-center gap-2">
          {eyebrow}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32 }}
            className="max-w-3xl text-balance text-[22px] font-semibold leading-tight tracking-tight sm:text-2xl"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/50">{subtitle}</p>
          )}
          {meta && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {meta}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <hr className="hr-hairline mt-5" />
    </div>
  );
}

export function HashText({ hash, link }: { hash: string; link?: string }) {
  if (!hash) return null;
  const short = hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
  const mono = "hash font-mono text-[11px] tracking-tight";
  if (link) {
    return (
      <Link
        href={link}
        title={hash}
        className={`${mono} inline-flex items-center gap-1 rounded bg-white/[0.035] px-1.5 py-0.5 text-cyan-300/90 ring-1 ring-white/10 transition hover:bg-cyan-400/10 hover:text-cyan-200 hover:ring-cyan-400/25`}
      >
        <span className="size-1 shrink-0 rounded-full bg-cyan-400/70" aria-hidden />
        {short}
      </Link>
    );
  }
  return (
    <span
      title={hash}
      className={`${mono} inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-white/45`}
    >
      <span className="size-1 shrink-0 rounded-full bg-white/25" aria-hidden />
      {short}
    </span>
  );
}

export function StatCard({
  label,
  children,
  hint,
  delay = 0,
  variant = "default",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  delay?: number;
  variant?: "default" | "compact";
}) {
  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay, ease: [0.22, 1, 0.36, 1] }}
        className="stat-compact group"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/38">{label}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-white/32">{hint ?? "\u00A0"}</div>
        </div>
        <div className="shrink-0 text-right font-mono text-lg font-semibold tabular-nums tracking-tight">
          {children}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className="panel panel-glow p-5"
    >
      <div className="text-xs font-medium uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{children}</div>
      {hint && <div className="mt-1 text-xs text-white/35">{hint}</div>}
    </motion.div>
  );
}

export function EvidenceMetaPill({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{label}</span>
      <span className="font-mono text-xs text-white/75">{children}</span>
    </span>
  );
}
