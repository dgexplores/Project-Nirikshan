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
  { href: "/ask", label: "Ask" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/92 backdrop-blur supports-[backdrop-filter]:bg-[#070b14]/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 focus-visible:outline-none">
          <DetectiveMark className="size-7 sm:size-8" />
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tracking-tight text-slate-100 sm:text-[15px]">Bharat Data Detective</span>
            <span className="hidden rounded border border-amber-400/35 bg-amber-400/10 px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-amber-400 sm:inline-block">BDD</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="ml-auto min-w-0">
          <ul className="flex items-center gap-0.5 overflow-x-auto overscroll-contain whitespace-nowrap text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {LINKS.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "inline-flex rounded-full bg-white/[0.09] px-2.5 py-1.5 text-xs font-semibold text-slate-50 sm:px-3 sm:py-2 sm:text-sm"
                        : "inline-flex rounded-full px-2.5 py-1.5 text-xs text-slate-400 transition hover:bg-white/[0.05] hover:text-slate-200 sm:px-3 sm:py-2 sm:text-sm"
                    }
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
            <li className="hidden shrink-0 sm:block">
              <Link href="/#how-it-works" className="inline-flex rounded-full px-3 py-2 text-sm text-slate-500 hover:text-slate-300">
                Help
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
