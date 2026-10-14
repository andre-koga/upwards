"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * A few mutually exclusive choices laid out as one row of segments, for a
 * choice that deserves to stay visible (not a dropdown) but not a tall card per
 * option. It is a Radix radio group underneath, so it keeps `role="radiogroup"`,
 * roving focus and arrow-key selection.
 */
function SegmentedControl({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="segmented-control"
      className={cn(
        "grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1",
        className
      )}
      {...props}
    />
  );
}

function SegmentedControlItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="segmented-control-item"
      className={cn(
        "h-9 min-w-0 truncate rounded-md px-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
