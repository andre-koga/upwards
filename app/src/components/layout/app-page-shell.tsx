import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppPageShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Icon rendered inline before the title (e.g. a page-level Lucide icon). */
  titleIcon?: ReactNode;
  /** Overrides the default vertical rhythm (`space-y-6 p-4 pb-24`). */
  className?: string;
  children: ReactNode;
}

/** Standard secondary-page container with a header (title, optional icon and subtitle). */
export function AppPageShell({
  title,
  subtitle,
  titleIcon,
  className,
  children,
}: AppPageShellProps) {
  return (
    <div className={cn("space-y-6 p-4 pb-24", className)}>
      <header className="space-y-1">
        <h1
          className={cn(
            "text-2xl font-bold tracking-tight",
            titleIcon != null && "flex items-center gap-2"
          )}
        >
          {titleIcon}
          {title}
        </h1>
        {subtitle != null ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </div>
  );
}
