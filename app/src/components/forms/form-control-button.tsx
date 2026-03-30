import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
    <Button
      type={type}
      variant="outline"
      className={cn(dialogFormControlButtonClassName, className)}
      {...props}
    >
      {children}
    </Button>
  );
}
