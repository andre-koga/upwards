import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatsSectionCard({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon?: LucideIcon;
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-muted/30 p-3", className)}>
      {(Icon || label) && (
        <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
          {label ? (
            <span className="text-[11px] font-medium uppercase tracking-wide">
              {label}
            </span>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}
