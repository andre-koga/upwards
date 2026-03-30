import type { ComponentPropsWithoutRef } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface SettingsSectionProps extends ComponentPropsWithoutRef<"section"> {
  title: string;
  icon?: LucideIcon;
  description?: string;
}

export function SettingsSection({
  title,
  icon: Icon,
  description,
  className,
  children,
  ...props
}: SettingsSectionProps) {
  return (
    <section
      className={cn("overflow-hidden rounded-lg border border-border", className)}
      {...props}
    >
      <header className="border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium leading-none">
          {Icon ? (
            <Icon
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}
