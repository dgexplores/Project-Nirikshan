import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--brand)] text-white font-semibold shadow-sm hover:bg-[var(--brand-hover)] disabled:bg-[var(--brand)]/50",
  ghost:
    "border border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--background)]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
