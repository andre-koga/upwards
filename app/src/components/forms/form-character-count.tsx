import { cn } from "@/lib/utils";

interface FormCharacterCountProps {
  current: number;
  max: number;
  className?: string;
}

export function FormCharacterCount({
  current,
  max,
  className,
}: FormCharacterCountProps) {
  return (
    <span
      className={cn(
        "block w-full text-right text-xs text-muted-foreground",
        className
      )}
    >
      {current}/{max}
    </span>
  );
}
