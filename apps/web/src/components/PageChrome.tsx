"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <motion.h1
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-2xl font-semibold tracking-tight"
        >
          {title}
        </motion.h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-white/50">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function HashText({ hash, link }: { hash: string; link?: string }) {
  const short = `${hash.slice(0, 10)}…${hash.slice(-6)}`;
  if (link) {
    return (
      <Link href={link} className="font-mono text-xs text-[#22d3ee]/90 hover:text-[#22d3ee]" title={hash}>
        {short}
      </Link>
    );
  }
  return (
    <span className="font-mono text-xs text-white/50" title={hash}>
      {short}
    </span>
  );
}

export function StatCard({
  label,
  children,
  hint,
  delay = 0,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  delay?: number;
}) {
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
