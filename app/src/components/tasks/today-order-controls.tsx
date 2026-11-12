import { ArrowDownToLine, ArrowDownUp, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TodayOrderState {
  /** Reorder and "Done last" are offered with two or more habits. */
  canArrange: boolean;
  /** Reorder is offered on today only. */
  canReorder: boolean;
  reordering: boolean;
  onToggleReorder: () => void;
  doneLast: boolean;
  onDoneLastChange: (next: boolean) => void;
}

const CONTROL_CLASS =
  "h-9 w-9 shrink-0 rounded-full p-0 shadow-none disabled:bg-transparent disabled:opacity-40";

/**
 * The person's say over "For today", in the section header: reorder by hand,
 * and "Done last". Icon-only, each with a name and a tooltip.
 */
export function TodayOrderControls(props: TodayOrderState) {
  const { t } = useTranslation("today", { keyPrefix: "order" });

  return (
    <div className="-mr-2 flex items-center gap-0.5">
      {props.canArrange && props.canReorder ? (
        <Button
          type="button"
          variant="ghost"
          onClick={props.onToggleReorder}
          aria-pressed={props.reordering}
          title={props.reordering ? t("doneReordering") : t("reorder")}
          aria-label={props.reordering ? t("doneReordering") : t("reorder")}
          className={cn(
            CONTROL_CLASS,
            props.reordering
              ? "bg-primary text-primary-foreground hover:bg-primary"
              : "text-muted-foreground"
          )}
        >
          {props.reordering ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <ArrowDownUp className="h-4 w-4" aria-hidden />
          )}
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
            props.doneLast ? "text-primary" : "text-muted-foreground"
          )}
        >
          <ArrowDownToLine className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
