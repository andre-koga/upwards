import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TabPageShellProps {
  /** Visible in the tab bar; repeated here for screen readers only. */
  title: string;
  /** Sticky frosted chrome (search, day picker, etc.), like Today’s header row. */
  stickyChrome?: ReactNode;
  /** Extra classes on the scrollable content block (e.g. tighter vertical rhythm). */
  contentClassName?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Primary tab routes skip the marketing-style title and subtitle. The bottom
 * tab (or sidebar) names the destination; content starts immediately, with
 * optional sticky controls at the top.
 */
export function TabPageShell({
  title,
  stickyChrome,
  contentClassName,
  className,
  children,
}: TabPageShellProps) {
  return (
    <div className={cn("pb-24", className)}>
      <h1 className="sr-only">{title}</h1>
      {stickyChrome ? (
        <div
          className="sticky top-0 z-[var(--z-chrome)] border-b border-border bg-background/85 backdrop-blur-md"
        >
          {stickyChrome}
        </div>
      ) : null}
      <div
        className={cn(
          "space-y-3 px-2 py-3 md:space-y-5 md:p-4",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
