import { Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PinToggleProps {
  pinned: boolean;
  /** Toggles the pin. Omit where pinning is not offered (read-only days). */
  onToggle?: () => void;
  /** Accessible name when the item is unpinned: "Pin to top". */
  pinLabel: string;
  /** Accessible name when the item is pinned: "Unpin". */
  unpinLabel: string;
  /** Read-only name for a pinned item that can't be changed here. */
  pinnedLabel: string;
  className?: string;
}

/**
 * The one pin control for Today's rows, habits and memos alike, at the far
 * right of the row and outside the row's own box. It is a button where pinning
 * can be changed; on a read-only day a pinned row keeps a quiet marker, and an
 * unpinned one shows nothing.
 */
export function PinToggle({
  pinned,
  onToggle,
  pinLabel,
  unpinLabel,
  pinnedLabel,
  className,
}: PinToggleProps) {
  if (!onToggle) {
    return pinned ? (
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground",
          className
        )}
      >
        <Pin className="h-3.5 w-3.5 fill-current" aria-hidden />
        <span className="sr-only">{pinnedLabel}</span>
      </span>
    ) : null;
  }

  const label = pinned ? unpinLabel : pinLabel;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onToggle}
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      className={cn(
        "h-8 w-8 shrink-0 rounded-md p-0 shadow-none",
        pinned
          ? "text-foreground"
          : "text-muted-foreground/50 hover:text-foreground",
        className
      )}
    >
      <Pin
        className={cn("h-3.5 w-3.5", pinned && "fill-current")}
        aria-hidden
      />
    </Button>
  );
}
