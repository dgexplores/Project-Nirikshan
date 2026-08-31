import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Findings name real dataset columns, so their text arrives carrying raw
 *  identifiers like `Differently_abled_persons_worked` or `district_code`.
 *  Underscores only ever come from those identifiers here, so turning them
 *  into spaces makes the sentence readable without changing its meaning. */
export function humanizeFields(text: string): string {
  return text.replace(/[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+/g, (id) => id.replace(/_/g, " "));
}

// Color classes for a fitness grade badge (A/B good, C medium, D/F high).
// Callers compose their own size/shape classes around this.
export function gradeToneClass(grade: string): string {
  if (["A", "B"].includes(grade)) return "border-[var(--good)]/25 bg-[var(--good-soft)] text-[var(--good)]";
  if (grade === "C") return "border-[var(--medium)]/25 bg-[var(--medium-soft)] text-[var(--medium)]";
  return "border-[var(--high)]/25 bg-[var(--high-soft)] text-[var(--high)]";
}
