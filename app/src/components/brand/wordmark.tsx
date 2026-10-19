import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The wordmark (design-and-branding.md §2.2): `upwards` in lowercase, in the
 * display face with tight tracking, beside a leaf in a rounded square of the
 * brand green. Never capitalized, never with a tagline in product chrome.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
        aria-hidden
      >
        <Leaf className="size-4" strokeWidth={1.8} />
      </span>
      <span className="font-display text-[1.2rem] tracking-[-0.03em] text-foreground">
        upwards
      </span>
    </div>
  );
}
