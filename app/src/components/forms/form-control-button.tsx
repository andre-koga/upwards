/**
 * SRP: Renders a dialog-form action button styled like FormField inputs (border, radius, height, focus ring).
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dialogFormControlButtonClassName } from "@/components/forms/styles";

export interface FormControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function FormControlButton({
  className,
  children,
  type = "button",
  ...props
}: FormControlButtonProps) {
  return (
    <button
      type={type}
      className={cn(dialogFormControlButtonClassName, className)}
      {...props}
    >
      {children}
    </button>
  );
}
