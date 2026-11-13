"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * A short list of mutually exclusive answers, one tall row each, for choices
 * whose wording is a full sentence and would not fit a segmented control. It is
 * a Radix radio group underneath: `role="radiogroup"`, roving focus and
 * arrow-key selection.
 */
function ChoiceGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="choice-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  );
}

function ChoiceGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="choice-group-item"
      className={cn(
        "group flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent bg-muted/60 px-3.5 py-2.5 text-left text-[0.9375rem] leading-snug text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary/10",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/60 group-data-[state=checked]:border-primary"
      >
        <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </RadioGroupPrimitive.Item>
  );
}

export { ChoiceGroup, ChoiceGroupItem };
