import { cn } from "@/lib/utils";
import { modifierLabel } from "@/lib/navigation/platform";

/** Decorative key hint. The real shortcut is exposed with `aria-keyshortcuts`. */
export function ShortcutChip({
  keys,
  className,
}: {
  keys: string;
  className?: string;
}) {
  return (
    <kbd
      aria-hidden
      className={cn(
        "rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted-foreground",
        className
      )}
    >
      {modifierLabel()}
      {keys}
    </kbd>
  );
}
