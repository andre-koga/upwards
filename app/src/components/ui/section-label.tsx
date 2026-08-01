import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

interface SectionLabelProps extends ComponentPropsWithoutRef<"p"> {
  /** Render the label styles onto the child element instead of a `<p>` (e.g. an `h2` section heading). */
  asChild?: boolean;
  children: ReactNode;
}

/** Overline-style label for in-page sections. */
export function SectionLabel({
  asChild = false,
  className,
  children,
  ...props
}: SectionLabelProps) {
  const Comp = asChild ? Slot : "p";
  return (
    <Comp
      className={cn(
        "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
