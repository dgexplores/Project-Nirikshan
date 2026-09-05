"use client";

import Link from "next/link";
import { ArrowIcon } from "./PageChrome";
import { Panel } from "./ui/Panel";

export interface NextStep {
  label: string;
  hint: string;
  href: string;
}

/**
 * Plain-language "what is this and what do I do" per finding kind.
 * Every step is a link that takes the user where they need to go:
 * the exact rows, the file, a comparison, or a pre-written question.
 */
export function stepsForFinding(
  kind: string,
  artifactIds: string[],
  findingTitle: string,
): { what: string; steps: NextStep[] } {
  const [a, b] = artifactIds;
  const fileHref = (id: string) => `/datasets/${encodeURIComponent(id)}`;
  const askHref = (q: string, scope: string[]) =>
    `/ask?q=${encodeURIComponent(q)}${scope.length ? `&scope=${scope.map(encodeURIComponent).join(",")}` : ""}`;
  const compareHref =
    a && b ? `/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}` : "/compare";

  switch (kind) {
    case "anomaly":
      return {
        what: "One number stands out strongly from similar rows. It may be a real event, a data-entry slip, or a boundary change.",
        steps: [
          { label: "Check the exact rows above", hint: "see which place and time it is", href: "#exact-rows" },
          ...(a ? [{ label: "Open the file for context", hint: "surrounding rows tell the story", href: fileHref(a) }] : []),
          ...(a
            ? [{ label: "Ask why it stands out", hint: "we answer with proof", href: askHref(`Why is this unusual: ${findingTitle}`, [a]) }]
            : []),
        ],
      };
    case "benford":
      return {
        what: "The first digits of numbers in one column don't follow the pattern real-world data usually has. Worth checking what that column really means.",
        steps: [
          { label: "Check the exact rows above", hint: "see which numbers drive the pattern", href: "#exact-rows" },
          ...(a ? [{ label: "Open the file for context", hint: "is it amounts, counts, or IDs?", href: fileHref(a) }] : []),
          ...(a ? [{ label: "Ask about this column", hint: "we answer with proof", href: askHref(`What does the digit pattern mean: ${findingTitle}`, [a]) }] : []),
        ],
      };
    case "drift":
      return {
        what: "The meaning, unit, or scope of something changed between two releases. Numbers across that change can't be compared directly.",
        steps: [
          ...(a && b
            ? [{ label: "Re-run the comparison", hint: "see what exactly changed", href: compareHref }]
            : []),
          ...(a ? [{ label: "Open the newer file", hint: "check its definition", href: fileHref(b ?? a) }] : []),
          { label: "Confirm with the publisher", hint: "which definition is current?", href: "/datasets" },
        ],
      };
    case "contradiction":
      return {
        what: "Two sources report different totals for what looks like the same thing. At least one needs a closer look.",
        steps: [
          ...(a && b ? [{ label: "Re-run the comparison", hint: "totals side by side", href: compareHref }] : []),
          ...(a ? [{ label: "Open the first file", hint: "check its time period and unit", href: fileHref(a) }] : []),
          ...(b ? [{ label: "Open the second file", hint: "check its time period and unit", href: fileHref(b) }] : []),
        ],
      };
    case "consensus":
      return {
        what: "Several reports repeat one number, but they trace back to a single origin. It looks like many confirmations, it is really one.",
        steps: [
          ...(a && b ? [{ label: "See the comparison", hint: "the two totals side by side", href: compareHref }] : []),
          { label: "Find an independent source", hint: "real confirmation needs a second origin", href: "/datasets" },
        ],
      };
    default:
      return {
        what: "Something in the data is worth a human look.",
        steps: a ? [{ label: "Open the file", hint: "start from the source", href: fileHref(a) }] : [],
      };
  }
}

export function NextSteps({ kind, artifactIds, findingTitle }: { kind: string; artifactIds: string[]; findingTitle: string }) {
  const { what, steps } = stepsForFinding(kind, artifactIds, findingTitle);
  if (!steps.length) return null;
  return (
    <Panel className="p-4">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">What to do about this</h3>
      <p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">{what}</p>
      <ol className="mt-3 space-y-1.5">
        {steps.map((s, i) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 transition hover:border-[var(--brand)]/30 hover:bg-[var(--brand-soft)]"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--good)] text-xs font-bold text-white">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-tight text-[var(--foreground)]">{s.label}</span>
                <span className="block text-xs leading-tight text-[var(--foreground-faint)]">{s.hint}</span>
              </span>
              <ArrowIcon className="size-3.5 shrink-0 text-[var(--foreground-faint)]" />
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
