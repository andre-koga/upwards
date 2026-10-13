import { ArrowDownUp, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TodayOrderBarProps {
  /** Reorder is offered on today only. */
  canReorder: boolean;
  reordering: boolean;
  /** The AI's order is in view: go back to yours before moving rows by hand. */
  reorderBlockedByAi: boolean;
  onToggleReorder: () => void;
  doneLast: boolean;
  onDoneLastChange: (next: boolean) => void;
}

/**
 * The person's own say over "For today": move rows by hand, and choose whether
 * finished habits sink. Both are plain controls with a keyboard path (every
 * row gets up/down buttons while reordering), and neither needs the AI.
 */
export function TodayOrderBar({
  canReorder,
  reordering,
  reorderBlockedByAi,
  onToggleReorder,
  doneLast,
  onDoneLastChange,
}: TodayOrderBarProps) {
  const { t } = useTranslation("today", { keyPrefix: "order" });

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {canReorder ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleReorder}
            disabled={reorderBlockedByAi && !reordering}
            aria-pressed={reordering}
            title={reorderBlockedByAi ? t("reorderBlockedByAi") : undefined}
            className="h-7 gap-1.5 rounded-full px-2.5 text-xs font-medium shadow-none"
          >
            {reordering ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
            )}
            {reordering ? t("doneReordering") : t("reorder")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onDoneLastChange(!doneLast)}
          aria-pressed={doneLast}
          title={t("doneLastHint")}
          className={cn(
            "h-7 gap-1.5 rounded-full px-2.5 text-xs font-medium shadow-none",
            doneLast ? "" : "text-muted-foreground"
          )}
        >
          {doneLast ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
          {t("doneLast")}
        </Button>
      </div>
      {reordering ? (
        <p className="text-[11px] text-muted-foreground">{t("reorderHint")}</p>
      ) : reorderBlockedByAi && canReorder ? (
        <p className="text-[11px] text-muted-foreground">
          {t("reorderBlockedByAi")}
        </p>
      ) : null}
    </div>
  );
}
