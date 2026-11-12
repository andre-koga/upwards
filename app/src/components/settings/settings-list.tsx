import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  ExternalLink,
  Loader2,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The Settings page is a plain grouped list: a small spaced label, then one
 * tonal panel whose rows are split by hairlines, then an optional footnote.
 * Every row has the same height, padding and type, so the page reads as one
 * organised instrument rather than a stack of differently shaped cards.
 */
export function SettingsGroup({
  id,
  title,
  footer,
  children,
}: {
  id?: string;
  title: string;
  /** Explanatory footnote under the panel. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-6">
      <h2
        id={headingId}
        className="mb-2 px-4 text-[0.75rem] font-medium uppercase tracking-[0.12em] text-muted-foreground"
      >
        {title}
      </h2>
      <div className="divide-y divide-foreground/[0.07] overflow-hidden rounded-2xl bg-muted/45">
        {children}
      </div>
      {footer ? (
        <div className="mt-2 px-4 text-xs leading-relaxed text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

const ROW = "flex min-h-[3.25rem] w-full items-center gap-3 px-4 py-3";
const ROW_LABEL = "text-[0.9375rem] font-normal leading-snug text-foreground";
const ROW_HINT = "text-xs leading-relaxed text-muted-foreground";

/** A setting: label (and hint) on the left, its control on the right. */
export function SettingsRow({
  label,
  hint,
  hintId,
  htmlFor,
  icon: Icon,
  control,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** Lets the control point `aria-describedby` at the hint. */
  hintId?: string;
  /** The control's id, so the label is clickable and announced. */
  htmlFor?: string;
  icon?: LucideIcon;
  control?: ReactNode;
  /** Extra content under the label (alerts, status). */
  children?: ReactNode;
}) {
  return (
    <div className={ROW}>
      {Icon ? (
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : null}
      <div className="min-w-0 flex-1 space-y-0.5">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className={ROW_LABEL}>
            {label}
          </Label>
        ) : (
          <p className={ROW_LABEL}>{label}</p>
        )}
        {hint ? (
          <p id={hintId} className={ROW_HINT}>
            {hint}
          </p>
        ) : null}
        {children}
      </div>
      {control ? <div className="shrink-0">{control}</div> : null}
    </div>
  );
}

/** A label and a read-only value, for status lines (last synced…). */
export function SettingsValueRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className={cn(ROW, "justify-between")}>
      <span className={ROW_LABEL}>{label}</span>
      <span className="min-w-0 truncate text-right text-sm tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

type ActionTarget =
  | { to: string; href?: never; onClick?: never }
  | { href: string; to?: never; onClick?: never }
  | { onClick: () => void; to?: never; href?: never };

/**
 * A row you press: opens a page (chevron), an external link (arrow) or runs
 * an action. `trailing` shows a value or badge before the chevron.
 */
export function SettingsActionRow({
  icon: Icon,
  label,
  hint,
  trailing,
  disabled,
  tone = "default",
  ariaLabel,
  busy = false,
  expanded,
  controls,
  describedBy,
  ...target
}: {
  icon?: LucideIcon;
  label: ReactNode;
  hint?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  tone?: "default" | "destructive";
  ariaLabel?: string;
  /** Swaps the icon for a spinner while the action runs. */
  busy?: boolean;
  /** For a row that reveals content below it. */
  expanded?: boolean;
  controls?: string;
  describedBy?: string;
} & ActionTarget) {
  const RowIcon = busy ? Loader2 : Icon;
  const content = (
    <>
      {RowIcon ? (
        <RowIcon
          className={cn(
            "h-4 w-4 shrink-0",
            busy && "animate-spin",
            tone === "destructive"
              ? "text-destructive"
              : "text-muted-foreground"
          )}
          aria-hidden
        />
      ) : null}
      <span className="min-w-0 flex-1 space-y-0.5 text-left">
        <span
          className={cn(
            "block whitespace-normal",
            ROW_LABEL,
            tone === "destructive" && "text-destructive"
          )}
        >
          {label}
        </span>
        {hint ? (
          <span className={cn("block whitespace-normal", ROW_HINT)}>
            {hint}
          </span>
        ) : null}
      </span>
      {trailing}
      {target.to ? (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground/70"
          aria-hidden
        />
      ) : target.href ? (
        <ExternalLink
          className="h-4 w-4 shrink-0 text-muted-foreground/70"
          aria-hidden
        />
      ) : null}
    </>
  );

  const className = cn(
    ROW,
    "h-auto justify-start rounded-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-inset focus-visible:ring-offset-0 active:bg-foreground/[0.06] disabled:bg-transparent disabled:opacity-50"
  );

  if (target.to) {
    return (
      <Button variant="bare" className={className} asChild>
        <Link to={target.to} aria-label={ariaLabel}>
          {content}
        </Link>
      </Button>
    );
  }
  if (target.href) {
    return (
      <Button variant="bare" className={className} asChild>
        <a
          href={target.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
        >
          {content}
        </a>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="bare"
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-describedby={describedBy}
      onClick={target.onClick}
    >
      {content}
    </Button>
  );
}

/** Free-form content inside a group (forms, status text). */
export function SettingsBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-3 px-4 py-4", className)}>{children}</div>;
}
