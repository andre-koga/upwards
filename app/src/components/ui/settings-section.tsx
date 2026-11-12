import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

interface SettingsSectionProps extends ComponentPropsWithoutRef<"section"> {
  title: string;
  description?: string;
}

export function SettingsSection({
  title,
  description,
  className,
  children,
  ...props
}: SettingsSectionProps) {
  return (
    <section className={cn("space-y-3 px-2", className)} {...props}>
      <header className="space-y-1">
        <h2 className="font-display text-[1.25rem] font-medium leading-tight tracking-[-0.01em]">
          {title}
        </h2>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
