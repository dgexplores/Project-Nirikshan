"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DetectiveMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={className}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    >
      <ellipse cx="13" cy="9" rx="7" ry="3.5" className="stroke-[#22d3ee]" />
      <path d="M6 9v5c0 1.93 3.13 3.5 7 3.5s7-1.57 7-3.5V9" className="stroke-[#22d3ee]/60" />
      <circle cx="18" cy="18" r="6" className="stroke-amber-400" />
      <path d="m22.5 22.5 4 4" className="stroke-amber-400" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/datasets", label: "Datasets" },
  { href: "/findings", label: "Findings" },
  { href: "/compare", label: "Compare" },
  { href: "/ask", label: "Ask Detective" },
  { href: "/#how-it-works", label: "Help" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <DetectiveMark className="size-8" />
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight text-slate-100 sm:text-base">
              Bharat Data Detective
            </span>
            <span className="hash rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
              BDD
            </span>
          </span>
        </Link>
        <nav aria-label="Primary" className="ml-auto">
          <ul className="flex items-center gap-1 text-sm">
            {LINKS.map(({ href, label }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "rounded-lg bg-white/[0.07] px-3 py-2 font-medium text-slate-50"
                        : "rounded-lg px-3 py-2 text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
                    }
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
