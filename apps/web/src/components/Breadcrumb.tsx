"use client";

import Link from "next/link";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && (
            <span aria-hidden className="text-[var(--foreground-faint)]">
              /
            </span>
          )}
          {it.href ? (
            <Link
              href={it.href}
              className="max-w-[20ch] truncate text-[var(--foreground-muted)] transition hover:text-[var(--brand)] hover:underline sm:max-w-none"
              title={it.label}
            >
              {it.label}
            </Link>
          ) : (
            <span className="max-w-[22ch] truncate font-medium text-[var(--foreground)] sm:max-w-none" title={it.label}>
              {it.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
