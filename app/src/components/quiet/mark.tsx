import { cn } from "@/lib/utils";

/** Empty circle, or the same circle with a check. No fill, no flame. */
export function QuietMark({ done }: { done: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("h-4 w-4 shrink-0", done ? "text-ink" : "text-ink-faint")}
      aria-hidden
    >
      <circle
        cx="8"
        cy="8"
        r="6.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      {done ? (
        <path
          d="M4.6 8.2 7 10.4 11.4 5.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      ) : null}
    </svg>
  );
}
