"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowIcon } from "@/components/PageChrome";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { KIND_LABEL } from "@/lib/labels";
import { humanizeFields } from "@/lib/utils";
import type { DashboardSummary } from "@/lib/api";
import type { Severity } from "@/lib/types";

// Exponential ease-out. One staged entrance owns the page's motion budget,
// so the sections below stay still rather than each announcing themselves.
const EASE = [0.16, 1, 0.3, 1] as const;

type Finding = DashboardSummary["recent_findings"][number];

export function HomeHero({
  summary,
  featured,
  onSeed,
  seeding,
}: {
  summary: DashboardSummary;
  /** The single finding worth leading with, chosen by the page so the queue
   *  below can leave it out instead of repeating it as row one. */
  featured: Finding | null;
  onSeed: () => void;
  seeding: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const empty = summary.artifacts === 0;

  const rise = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { duration: 0.7, delay, ease: EASE },
        };

  return (
    <section className="pb-8 pt-2 lg:pb-12">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
        <div>
          <motion.h1
            {...rise(0)}
            className="max-w-[16ch] text-balance text-[34px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[44px] lg:text-[52px]"
          >
            Find what doesn&apos;t add up in India&apos;s public data.
          </motion.h1>

          <motion.p
            {...rise(0.08)}
            className="mt-5 max-w-[54ch] text-[17px] leading-relaxed text-[var(--foreground-muted)]"
          >
            Upload any government dataset. We check it five different ways, flag anything
            that looks off, and show you the evidence behind every single flag. You decide
            what it means, we never decide for you.
          </motion.p>

          <motion.div {...rise(0.15)} className="mt-7 flex flex-wrap items-center gap-2.5">
            {empty ? (
              <>
                <Button onClick={onSeed} disabled={seeding} className="px-5 py-3 text-[15px]">
                  {seeding ? (
                    <>
                      <Spinner className="size-4" /> Loading a sample…
                    </>
                  ) : (
                    <>
                      Load sample data <ArrowIcon className="size-4" />
                    </>
                  )}
                </Button>
                <Link href="/datasets" className={buttonClass("ghost", "px-5 py-3 text-[15px]")}>
                  Upload your own file
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/findings?status=open"
                  className={buttonClass("primary", "px-5 py-3 text-[15px]")}
                >
                  See what we found <ArrowIcon className="size-4" />
                </Link>
                <Link href="/datasets" className={buttonClass("ghost", "px-5 py-3 text-[15px]")}>
                  Upload your own file
                </Link>
              </>
            )}
          </motion.div>

          <motion.p
            {...rise(0.22)}
            className="mt-6 max-w-[52ch] text-sm leading-relaxed text-[var(--foreground-faint)]"
          >
            Running on real government data, not just demos. We ingested Punjab&apos;s
            school enrollment figures (2019&ndash;2022) and MGNREGA records straight from{" "}
            <span className="font-medium text-[var(--foreground-muted)]">data.gov.in</span>,
            and the checks below found something worth a second look.
          </motion.p>
        </div>

        <motion.div
          {...(reduceMotion
            ? {}
            : {
                initial: { opacity: 0, y: 20, filter: "blur(8px)" },
                animate: { opacity: 1, y: 0, filter: "blur(0px)" },
                transition: { duration: 0.8, delay: 0.28, ease: EASE },
              })}
        >
          {featured ? (
            <Link
              href={`/findings/${encodeURIComponent(featured.id)}`}
              className="panel panel-interactive group block p-5 focus-visible:outline-none sm:p-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={featured.severity as Severity} />
                <span className="text-sm text-[var(--foreground-muted)]">
                  {KIND_LABEL[featured.kind] ?? featured.kind}
                </span>
              </div>

              {/* Column names arrive as raw identifiers, so long unbroken
                  tokens have to be allowed to break rather than overflow. */}
              <h2 className="mt-3.5 break-words text-pretty text-[19px] font-semibold leading-snug tracking-[-0.01em] group-hover:text-[var(--brand)] sm:text-[21px]">
                {humanizeFields(featured.title)}
              </h2>

              <p className="mt-2.5 break-words text-[15px] leading-relaxed text-[var(--foreground-muted)]">
                {humanizeFields(featured.summary)}
              </p>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                <span className="text-sm text-[var(--foreground-muted)]">
                  One of {summary.findings_total.toLocaleString("en-IN")} things we found
                </span>
                <span className="row-action inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)]">
                  See the proof <ArrowIcon className="size-4" />
                </span>
              </div>
            </Link>
          ) : (
            <div className="panel p-6 sm:p-7">
              <h2 className="text-[19px] font-semibold leading-snug tracking-[-0.01em]">
                Nothing checked yet
              </h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--foreground-muted)]">
                Load the sample data and you&apos;ll see real findings appear right here, each
                one with the evidence behind it, in about a second.
              </p>
              <Button
                onClick={onSeed}
                disabled={seeding}
                className="mt-5 w-full px-5 py-3 text-[15px] sm:w-auto"
              >
                {seeding ? (
                  <>
                    <Spinner className="size-4" /> Loading a sample…
                  </>
                ) : (
                  <>
                    Load sample data <ArrowIcon className="size-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
