import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full appearance-none rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)]/60 focus:ring-2 focus:ring-[var(--brand)]/15",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
