import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Color classes for a fitness grade badge (A/B good, C medium, D/F high).
// Callers compose their own size/shape classes around this.
export function gradeToneClass(grade: string): string {
  if (["A", "B"].includes(grade)) return "border-[var(--good)]/25 bg-[var(--good-soft)] text-[var(--good)]";
  if (grade === "C") return "border-[var(--medium)]/25 bg-[var(--medium-soft)] text-[var(--medium)]";
  return "border-[var(--high)]/25 bg-[var(--high-soft)] text-[var(--high)]";
}
