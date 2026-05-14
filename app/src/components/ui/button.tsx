import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Hover/focus affordances for real controls live here — avoid one-off hover: classes in feature code. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:border-input disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow transition-colors hover:bg-[color-mix(in_srgb,hsl(var(--primary))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--primary))_88%,white)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm transition-colors hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)]",
        outline:
          "border border-input bg-background text-foreground shadow-sm transition-colors hover:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm transition-colors hover:bg-muted",
        ghost: "transition-colors hover:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
        /** Dashed border; used for secondary "add" CTAs in drawers and lists. */
        outlineDashed:
          "border border-dashed border-input bg-background text-muted-foreground shadow-none transition-colors hover:bg-muted",
        /** Task row completion control — incomplete state. */
        taskTodo:
          "rounded-full border border-muted-foreground bg-transparent text-muted-foreground shadow-none transition-colors hover:bg-muted hover:text-foreground",
        /** Task row completion control — complete state. */
        taskComplete:
          "rounded-full border border-primary bg-primary text-primary-foreground shadow-none transition-colors hover:bg-[color-mix(in_srgb,hsl(var(--primary))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--primary))_88%,white)]",
        /**
         * No default chrome — for full-bleed hit targets (e.g. video) or controls on
         * tinted surfaces. Add borders, layout, and colors via className.
         */
        bare:
          "select-none border-0 bg-transparent p-0 shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9 [&_svg]:size-4",
        smIcon: "h-6 w-6 [&_svg]:size-4",
        iconRoundMd: "h-9 w-9 shrink-0 rounded-full p-0",
        iconRoundLg: "h-10 w-10 shrink-0 rounded-full p-0",
        /** Floating nav control — matches previous h-12 w-12 chrome. */
        floatingNav: "h-12 w-12 shrink-0 rounded-full p-0 shadow-md",
        taskSm: "h-7 w-7 min-h-[1.75rem] min-w-[1.75rem] p-0 gap-0",
        taskMd: "h-7 min-h-[1.75rem] w-[2.75rem] min-w-[2.75rem] p-0 gap-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
