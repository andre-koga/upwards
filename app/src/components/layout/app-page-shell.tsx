import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  PageBreadcrumbs,
  type BreadcrumbItem,
} from "@/components/layout/page-breadcrumbs";

interface AppPageShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Icon rendered inline before the title (e.g. a page-level Lucide icon). */
  titleIcon?: ReactNode;
  /** Desktop breadcrumbs shown above the title. */
  breadcrumbs?: BreadcrumbItem[];
  /** Overrides the default vertical rhythm (`space-y-6 p-4 pb-24`). */
  className?: string;
  children: ReactNode;
}

/** Standard secondary-page container with a header (title, optional icon and subtitle). */
export function AppPageShell({
  title,
  subtitle,
  titleIcon,
  breadcrumbs,
  className,
  children,
}: AppPageShellProps) {
  return (
    <div
      className={cn(
        "space-y-6 p-4 pb-24 md:mx-auto md:max-w-3xl md:pb-8",
        className
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <PageBreadcrumbs items={breadcrumbs} className="mb-0" />
      ) : null}
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
