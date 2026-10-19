import {
  ArrowDownToLine,
  ArrowDownUp,
  Check,
  Loader2,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getActiveLocaleTag } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AiOrderError } from "./hooks/use-ai-today-order";
import { settingsPanelPath } from "@/lib/settings/panels";

export interface TodayOrderState {
  /** The AI ordering control is offered (an AI key may or may not be set up). */
  aiCanOrder: boolean;
  aiAvailable: boolean;
  aiLoading: boolean;
  aiError: AiOrderError | null;
  /** ISO time of the order in use, or null when the list is in the person's own order. */
  aiGeneratedAt: string | null;
  aiStale: boolean;
  onAiOrder: () => void;
  onAiReset: () => void;
  /** Reorder and "Done last" are offered with two or more habits. */
  canArrange: boolean;
  /** Reorder is offered on today only. */
  canReorder: boolean;
  reordering: boolean;
  onToggleReorder: () => void;
  doneLast: boolean;
  onDoneLastChange: (next: boolean) => void;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(getActiveLocaleTag(), {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Icon on a phone, icon and label from `sm`. The label is always the name. */
const CONTROL_CLASS =
  "h-9 w-9 shrink-0 gap-1.5 rounded-full p-0 text-xs font-medium shadow-none sm:w-auto sm:px-2.5";

function Label({ children }: { children: string }) {
  return <span className="sr-only sm:not-sr-only">{children}</span>;
}

/**
 * The person's say over "For today", as controls that sit in the section header
 * beside its label: order with AI, back to my order, reorder by hand, and
 * "Done last". Every one has a name for assistive tech and a tooltip; the text
 * shows from `sm`. Their messages live in {@link TodayOrderStatus}.
 */
export function TodayOrderControls(props: TodayOrderState) {
  const { t } = useTranslation("today", { keyPrefix: "order" });
  const { t: tAi } = useTranslation("today", { keyPrefix: "aiOrder" });
  const ordered = props.aiGeneratedAt !== null;
  const aiOrderLabel = ordered ? tAi("orderAgain") : tAi("order");

  return (
    <div className="-mr-2 flex items-center gap-0.5">
      {props.aiCanOrder ? (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={props.onAiOrder}
            disabled={props.aiLoading || !props.aiAvailable}
            title={tAi("evidence")}
            aria-label={aiOrderLabel}
            className={CONTROL_CLASS}
          >
            {props.aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4 text-gold-text" aria-hidden />
            )}
            <Label>{aiOrderLabel}</Label>
          </Button>
          {ordered && !props.aiLoading ? (
            <Button
              type="button"
              variant="ghost"
              onClick={props.onAiReset}
              title={tAi("reset")}
              aria-label={tAi("reset")}
              className={cn(CONTROL_CLASS, "text-muted-foreground")}
            >
              <Undo2 className="h-4 w-4" aria-hidden />
              <Label>{tAi("reset")}</Label>
            </Button>
          ) : null}
        </>
      ) : null}

      {props.canArrange && props.canReorder ? (
        <Button
          type="button"
          variant="ghost"
          onClick={props.onToggleReorder}
          disabled={ordered && !props.reordering}
          aria-pressed={props.reordering}
          title={ordered ? t("reorderBlockedByAi") : undefined}
          aria-label={props.reordering ? t("doneReordering") : t("reorder")}
          className={cn(
            CONTROL_CLASS,
            props.reordering && "bg-sage text-green-deep hover:bg-sage"
          )}
        >
          {props.reordering ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <ArrowDownUp className="h-4 w-4" aria-hidden />
          )}
          <Label>{props.reordering ? t("doneReordering") : t("reorder")}</Label>
        </Button>
      ) : null}

      {props.canArrange ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => props.onDoneLastChange(!props.doneLast)}
          aria-pressed={props.doneLast}
          title={t("doneLastHint")}
          aria-label={t("doneLast")}
          className={cn(
            CONTROL_CLASS,
            props.doneLast
              ? "bg-sage text-green-deep hover:bg-sage"
              : "text-muted-foreground"
          )}
        >
          <ArrowDownToLine className="h-4 w-4" aria-hidden />
          <Label>{t("doneLast")}</Label>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * What the controls above are doing or why they can't: AI progress and errors,
 * the evidence behind an AI order (design-and-branding.md §4), and the
 * reorder hint. Renders nothing when there is nothing to say, so the common
 * case is just the header and the list.
 */
export function TodayOrderStatus(props: TodayOrderState) {
  const { t } = useTranslation("today", { keyPrefix: "order" });
  const { t: tAi } = useTranslation("today", { keyPrefix: "aiOrder" });
  const ordered = props.aiGeneratedAt !== null;
  const notConfigured = props.aiError?.code === "not_configured";

  let status: string | null = null;
  if (!props.aiCanOrder) status = null;
  else if (props.aiLoading) status = tAi("ordering");
  else if (props.aiError) status = props.aiError.message;
  else if (ordered && props.aiGeneratedAt) {
    status = tAi("orderedAt", { time: clock(props.aiGeneratedAt) });
  } else if (!props.aiAvailable) status = tAi("needsConnection");

  const evidence =
    props.aiCanOrder && ordered && !props.aiError && !props.aiLoading
      ? props.aiStale
        ? tAi("stale")
        : tAi("evidence")
      : null;

  const hint =
    props.canArrange && props.canReorder
      ? props.reordering
        ? t("reorderHint")
        : ordered
          ? t("reorderBlockedByAi")
          : null
      : null;

  if (!status && !evidence && !hint && !notConfigured) return null;

  return (
    <div className="space-y-1 border-b border-border px-4 py-2">
      {status ? (
        <p
          role="status"
          className={
            props.aiError
              ? "text-xs text-destructive"
              : "font-mono text-[11px] tabular-nums text-muted-foreground"
          }
        >
          {status}
          {notConfigured ? (
            <>
              {" "}
              <Link
                to={settingsPanelPath("ai")}
                className="font-sans underline"
              >
                {tAi("setUp")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      {evidence ? (
        <p className="text-[11px] text-muted-foreground">{evidence}</p>
      ) : null}
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
