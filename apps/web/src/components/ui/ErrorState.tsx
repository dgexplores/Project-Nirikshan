import { BACKEND_DOWN } from "@/lib/api";
import { cn } from "@/lib/utils";

const REPO = "https://github.com/dgexplores/bharat-data-detective";

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/**
 * When the API host is unreachable, every page fails at once and a generic
 * "something went wrong" reads as a broken product. This says plainly that
 * the hosting is down rather than the code, and points at a way to run it.
 */
function BackendOffline({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={cn("panel px-6 py-9 text-center sm:px-8 sm:py-11", className)}
    >
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[var(--medium-soft)] text-[var(--medium)]">
        <WarningIcon className="size-5" />
      </span>

      <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.01em]">
        The hosted demo is offline right now
      </h2>

      <p className="mx-auto mt-2.5 max-w-[58ch] text-[15px] leading-relaxed text-[var(--foreground-muted)]">
        This page loaded fine, but the API behind it is not answering, because the
        free hosting plan it ran on has ended. Nothing is wrong with the project
        itself. You can run the whole thing on your own machine in one command,
        with the same real data included in the repository.
      </p>

      <div className="mx-auto mt-5 max-w-[62ch] overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-left">
        <code className="hash whitespace-pre text-xs leading-relaxed text-[var(--foreground-muted)]">
          git clone {REPO}.git{"\n"}
          cd bharat-data-detective{"\n"}
          docker compose -f infra/docker/compose.yml up --build
        </code>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <a
          href={REPO}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-hover)]"
        >
          View the code and data
        </a>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--background)]"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  if (message === BACKEND_DOWN) {
    return <BackendOffline onRetry={onRetry} className={className} />;
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-[var(--critical)]/25 bg-[var(--critical-soft)] px-6 py-9 text-center",
        className,
      )}
    >
      <WarningIcon className="size-7 text-[var(--critical)]" />
      <p className="text-sm text-[var(--foreground)]">Something went wrong: {message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-[var(--border-strong)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--background)]"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
