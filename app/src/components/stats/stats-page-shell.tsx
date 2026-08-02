import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import {
  PageBreadcrumbs,
  type BreadcrumbItem,
} from "@/components/layout/page-breadcrumbs";
import { cn } from "@/lib/utils";

export function StatsPageShell({
  title,
  icon,
  subtitle,
  backTo,
  backTitle,
  homeTo = "/",
  homeTitle,
  loading,
  children,
  className,
  breadcrumbs,
}: {
  title: ReactNode;
  icon?: ReactNode;
  subtitle?: string;
  backTo?: string;
  backTitle?: string;
  homeTo?: string;
  homeTitle?: string;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
  breadcrumbs?: BreadcrumbItem[];
}) {
  const { t: tStats } = useTranslation("stats");
  const { t: tNav } = useTranslation("nav");
  const resolvedBackTitle = backTitle ?? tStats("back");
  const resolvedHomeTitle = homeTitle ?? tNav("home");

  return (
    <div
      className={cn(
        "space-y-3 p-4 pb-24 md:mx-auto md:max-w-3xl md:pb-8",
        className
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <PageBreadcrumbs items={breadcrumbs} className="mb-0" />
      ) : null}
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          {icon}
          <span className="min-w-0 truncate">{title}</span>
        </h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </header>

      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border bg-muted/40"
            />
          ))}
        </div>
      ) : (
        children
      )}

      <div className="fixed bottom-3 left-4 z-50 flex items-center gap-2 md:bottom-auto md:left-auto md:right-4 md:top-3">
        <FloatingBackButton
          fixed={false}
          to={homeTo}
          title={resolvedHomeTitle}
          className={homeTo === "/" ? "md:hidden" : undefined}
        />
        {backTo && backTo !== homeTo ? (
          <FloatingBackButton
            fixed={false}
            to={backTo}
            title={resolvedBackTitle}
            icon="undo"
          />
        ) : null}
      </div>
    </div>
  );
}
