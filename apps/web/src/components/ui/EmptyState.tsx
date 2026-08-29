import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  hint,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel flex flex-col items-center justify-center gap-2 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">{icon}</div> : null}
      <p className="font-medium text-[var(--foreground)]">{title}</p>
      {hint ? <p className="max-w-sm text-sm leading-relaxed text-[var(--foreground-muted)]">{hint}</p> : null}
    </div>
  );
}
