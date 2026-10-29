import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

import { quietFocus } from "./focus";

type QuietFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** The dialog title already names the field. */
  labelHidden?: boolean;
};

export function QuietField({
  label,
  labelHidden = false,
  id,
  className,
  ...props
}: QuietFieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className={labelHidden ? "sr-only" : "text-sm text-ink-muted"}>
        {label}
      </span>
      <input
        id={id}
        className={cn(
          "w-full border-0 border-b border-foreground/15 bg-transparent pb-2 text-sm text-ink",
          labelHidden ? "mt-0" : "mt-3",
          "placeholder:text-ink-faint",
          quietFocus,
          "focus-visible:border-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0",
          className,
        )}
        {...props}
      />
    </label>
  );
}

type QuietWritingProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Journal line. Serif, no box. The underline is the only edge. */
export function QuietWriting({ className, ...props }: QuietWritingProps) {
  return (
    <textarea
      className={cn(
        "w-full resize-none border-0 border-b border-foreground/15 bg-transparent pb-3",
        "font-display text-xl font-normal leading-relaxed text-ink",
        "placeholder:text-ink-faint",
        quietFocus,
        "focus-visible:border-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0",
        className,
      )}
      {...props}
    />
  );
}
