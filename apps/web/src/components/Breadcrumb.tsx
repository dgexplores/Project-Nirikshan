"use client";

import Link from "next/link";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-white/20">/</span>}
          {it.href ? (
            <Link href={it.href} className="text-white/50 transition hover:text-white hover:underline">
              {it.label}
            </Link>
          ) : (
            <span className="font-medium text-white">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
