import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TodaySectionProps {
  label: ReactNode;
  /** Quiet figure beside the label: "3 of 6 done", a day total. */
  meta?: ReactNode;
  /** Trailing header content: quiet actions. */
  aside?: ReactNode;
  /** 0–1. Draws a thin progress line under the header. */
  progress?: number;
  className?: string;
  children: ReactNode;
}

/**
 * One block of Today (memos, the day's habits, the timeline). No card and no
 * rules: a label with its figure, then rows on the page. Blocks are told apart
 * by the space the page leaves between them.
 */
export function TodaySection({
  label,
  meta,
  aside,
  progress,
  className,
  children,
}: TodaySectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="space-y-1.5">
        <header className="flex min-h-9 items-baseline gap-2.5">
          <h2 className="font-display text-[1.3125rem] font-medium leading-tight tracking-[-0.01em]">
            {label}
          </h2>
          {meta ? (
            <span className="text-[0.8125rem] tabular-nums text-muted-foreground">
              {meta}
            </span>
          ) : null}
          {aside ? (
            <div className="ml-auto flex items-center self-center">{aside}</div>
          ) : null}
        </header>
        {typeof progress === "number" ? (
          <div
            className="h-[3px] overflow-hidden rounded-full bg-foreground/[0.07]"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${Math.round(Math.min(1, progress) * 100)}%` }}
            />
          </div>
        ) : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

/** A row inside a `TodaySection`, set apart from its neighbours by padding. */
export function TodayRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("py-1", className)}>{children}</div>;
}
