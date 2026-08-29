import { cn } from "@/lib/utils";

const FIELD =
  "w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] outline-none transition focus:border-[var(--brand)]/60 focus:ring-2 focus:ring-[var(--brand)]/15";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, className)} {...props} />;
}
