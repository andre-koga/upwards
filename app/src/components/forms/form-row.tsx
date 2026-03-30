import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormRowProps {
  children: ReactNode;
  className?: string;
}

export function FormRow({ children, className }: FormRowProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>{children}</div>
  );
}
