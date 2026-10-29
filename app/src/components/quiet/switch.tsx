import type { ComponentProps } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import { quietFocus } from "./focus";

type QuietSwitchProps = ComponentProps<typeof SwitchPrimitive.Root> & {
  label: string;
};

export function QuietSwitch({ label, className, id, ...props }: QuietSwitchProps) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-6">
      <label htmlFor={id} className="text-sm text-ink">
        {label}
      </label>
      <SwitchPrimitive.Root
        id={id}
        className={cn(
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          quietFocus,
          className,
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block h-3.5 w-3.5 rounded-full border border-foreground/30 bg-transparent",
            "data-[state=checked]:border-foreground data-[state=checked]:bg-foreground",
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
}
