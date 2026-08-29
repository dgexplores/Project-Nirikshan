"use client";

import Link from "next/link";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span aria-hidden className="px-0.5 font-mono text-[11px] text-white/20">
              /
            </span>
          )}
          {it.href ? (
            <Link
              href={it.href}
              className="max-w-[20ch] truncate font-mono text-[11px] tracking-tight text-white/45 transition hover:text-white hover:underline sm:max-w-none sm:text-xs"
              title={it.label}
            >
              {it.label}
            </Link>
          ) : (
            <span className="max-w-[22ch] truncate font-medium text-white sm:max-w-none" title={it.label}>
              {it.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
