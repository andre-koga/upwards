import { GitMerge, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ConflictChoice } from "@/lib/sync/field-diff";

/** Which button is working: a choice, or setting the conflict aside. */
export type ConflictBusy = ConflictChoice | "defer" | null;

/** The common frame of every conflict card: a mark, a heading, then the body. */
export function ConflictFrame({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="space-y-3 rounded-lg border border-border bg-card p-3">
      <header className="flex items-start gap-2">
        <GitMerge
          className="mt-0.5 h-4 w-4 shrink-0 text-gold-text"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">{title}</div>
      </header>
      {children}
    </article>
  );
}

/** A button that shows it is working, and is off while any choice is. */
export function ChoiceButton({
  busy,
  mine,
  disabled,
  title,
  variant = "outline",
  onClick,
  children,
}: {
  busy: ConflictBusy;
  mine: ConflictBusy;
  disabled?: boolean;
  title?: string;
  variant?: "default" | "outline" | "ghost";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className="h-11 md:h-8"
      disabled={busy != null || disabled}
      title={title}
      onClick={onClick}
    >
      {busy === mine ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </Button>
  );
}
