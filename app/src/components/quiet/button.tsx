import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

import { quietFocus } from "./focus";

type QuietButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `ink` is the act on the row. `quiet` is everything else. */
  tone?: "ink" | "quiet";
};

export function QuietButton({
  tone = "quiet",
  className,
  type = "button",
  ...props
}: QuietButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center text-sm",
        quietFocus,
        tone === "ink" ? "text-ink" : "text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}
