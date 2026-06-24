import type { ReactNode } from "react";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { cn } from "@/lib/utils";

export function StatsPageShell({
  title,
  icon,
  subtitle,
  backTo,
  backTitle = "Back",
  homeTo = "/",
  homeTitle = "Home",
  loading,
  children,
  className,
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
}) {
  return (
    <div className={cn("space-y-3 p-4 pb-24", className)}>
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          {icon}
          <span className="min-w-0 truncate">{title}</span>
        </h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </header>

      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      ) : (
        children
      )}

      <div className="fixed bottom-3 left-4 z-50 flex items-center gap-2">
        <FloatingBackButton fixed={false} to={homeTo} title={homeTitle} />
        {backTo && backTo !== homeTo ? (
          <FloatingBackButton
            fixed={false}
            to={backTo}
            title={backTitle}
            icon="undo"
          />
        ) : null}
      </div>
    </div>
  );
}
