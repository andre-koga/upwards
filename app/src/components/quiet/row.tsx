import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { QuietButton } from "./button";
import { QuietMark } from "./mark";
import { quietFocus } from "./focus";

const rowClass = "flex min-h-11 items-center gap-4";

export function QuietCheckRow({
  label,
  done,
  doneLabel,
  notDoneLabel,
  onDone,
}: {
  label: string;
  done: boolean;
  doneLabel: string;
  notDoneLabel: string;
  onDone: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={`${label}. ${done ? doneLabel : notDoneLabel}`}
      onClick={onDone}
      className={cn(
        rowClass,
        "-mx-3 w-[calc(100%+1.5rem)] px-3 text-left",
        quietFocus,
      )}
    >
      <QuietMark done={done} />
      <span className={cn("text-sm", done ? "text-ink-muted" : "text-ink")}>
        {label}
      </span>
    </button>
  );
}

export function QuietCountRow({
  label,
  countLabel,
  count,
  onIncrement,
}: {
  label: string;
  countLabel: string;
  count: number;
  onIncrement: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={countLabel}
      onClick={onIncrement}
      className={cn(
        rowClass,
        "-mx-3 w-[calc(100%+1.5rem)] justify-between px-3 text-left",
        quietFocus,
      )}
    >
      <span className="text-sm text-ink">{label}</span>
      <span className="font-mono text-sm tabular-nums text-ink">{count}</span>
    </button>
  );
}

export function QuietSlipRow({
  label,
  action,
  count,
  onAction,
}: {
  label: string;
  action: string;
  count: number;
  onAction: () => void;
}) {
  return (
    <div className={rowClass}>
      <span className="min-w-0 flex-1 text-sm text-ink">{label}</span>
      {count > 0 ? (
        <span className="font-mono text-sm tabular-nums text-ink-muted">
          {count}
        </span>
      ) : null}
      <QuietButton onClick={onAction}>{action}</QuietButton>
    </div>
  );
}

export function QuietMetaRow({
  label,
  meta,
}: {
  label: string;
  meta: string;
}) {
  return (
    <div className={cn(rowClass, "justify-between")}>
      <span className="text-sm text-ink">{label}</span>
      <span className="text-sm text-ink-muted">{meta}</span>
    </div>
  );
}

export function QuietTimerRow({
  label,
  elapsed,
  action,
  onAction,
}: {
  label: string;
  elapsed: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className={rowClass}>
      <span className="min-w-0 flex-1 text-sm text-ink">{label}</span>
      <span className="font-mono text-sm tabular-nums text-ink">{elapsed}</span>
      <QuietButton tone="ink" onClick={onAction}>
        {action}
      </QuietButton>
    </div>
  );
}

export function QuietActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-8", className)}>
      {children}
    </div>
  );
}
