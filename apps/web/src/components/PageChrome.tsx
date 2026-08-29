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
    <div className="mb-6">
      {eyebrow && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--foreground-muted)]">
          {eyebrow}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32 }}
            className="max-w-3xl text-balance text-[26px] font-semibold leading-tight tracking-tight sm:text-3xl"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--foreground-muted)]">{subtitle}</p>
          )}
          {meta && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {meta}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <hr className="hr-line mt-6" />
    </div>
  );
}

/** A verified-copy reference. The hash is a detail for people who want it,
 * not the headline, so it reads as "Verified" first and the hash on hover. */
export function HashText({ hash, link }: { hash: string; link?: string }) {
  if (!hash) return null;
  const short = hash.length > 18 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
  const base =
    "hash inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium";
  if (link) {
    return (
      <Link
        href={link}
        title={`Verified copy: ${hash}`}
        className={`${base} border border-[var(--good)]/25 bg-[var(--good-soft)] text-[var(--good)] transition hover:border-[var(--good)]/45`}
      >
        <CheckIcon className="size-3" />
        Verified <span className="opacity-60">{short}</span>
      </Link>
    );
  }
  return (
    <span
      title={`Verified copy: ${hash}`}
      className={`${base} border border-[var(--border)] bg-[var(--background)] text-[var(--foreground-muted)]`}
    >
      <CheckIcon className="size-3 text-[var(--good)]" />
      Verified <span className="opacity-60">{short}</span>
    </span>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M4 10.5 8 14.5 16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M4 10h12M12 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
        className="panel flex items-baseline justify-between gap-3 px-4 py-3.5"
      >
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-[var(--foreground-muted)]">{label}</div>
          <div className="mt-0.5 text-xs leading-snug text-[var(--foreground-faint)]">{hint ?? " "}</div>
        </div>
        <div className="shrink-0 text-right text-xl font-semibold tabular-nums tracking-tight">
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
      className="panel panel-interactive p-5"
    >
      <div className="text-sm font-medium text-[var(--foreground-muted)]">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{children}</div>
      {hint && <div className="mt-1 text-sm text-[var(--foreground-faint)]">{hint}</div>}
    </motion.div>
  );
}
