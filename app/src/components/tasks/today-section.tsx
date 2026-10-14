import type { ReactNode } from "react";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

interface TodaySectionProps {
  label: ReactNode;
  /** Trailing header content: a total, or a quiet action. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * One operational block of Today (memos, the day's habits, the timeline): an
 * opaque paper card with a hairline header, its rows bound to it by shared
 * dividers instead of each row carrying its own box.
 */
export function TodaySection({
  label,
  aside,
  className,
  children,
}: TodaySectionProps) {
  return (
    <section
      className={cn(
        "overflow-hidden border-y border-border bg-card md:rounded-xl md:border",
        className
      )}
    >
      <header className="flex min-h-11 items-center justify-between gap-2 border-b border-border px-4">
        <SectionLabel asChild>
          <h2>{label}</h2>
        </SectionLabel>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** A row inside a `TodaySection`, divided from its neighbours by a hairline. */
export function TodayRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-b border-border px-4 py-2.5 last:border-b-0",
        className
      )}
    >
      {children}
    </div>
  );
}
