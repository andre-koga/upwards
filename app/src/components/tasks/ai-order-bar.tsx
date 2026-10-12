import { Loader2, Sparkles, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getActiveLocaleTag } from "@/lib/i18n";
import type { AiOrderError } from "./hooks/use-ai-today-order";

interface AiOrderBarProps {
  available: boolean;
  loading: boolean;
  error: AiOrderError | null;
  /** ISO time of the order in use, or null when the list is in the no-AI order. */
  generatedAt: string | null;
  stale: boolean;
  onOrder: () => void;
  onReset: () => void;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(getActiveLocaleTag(), {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The AI ordering control for "For today" (design-and-branding.md §4). It names
 * its evidence and its ownership, offers the manual way back, and covers every
 * state without ever blocking the list: the list below is always usable.
 */
export function AiOrderBar({
  available,
  loading,
  error,
  generatedAt,
  stale,
  onOrder,
  onReset,
}: AiOrderBarProps) {
  const { t } = useTranslation("today", { keyPrefix: "aiOrder" });
  const ordered = generatedAt !== null;
  const notConfigured = error?.code === "not_configured";

  let status: string | null = null;
  if (loading) status = t("ordering");
  else if (error) status = error.message;
  else if (ordered) status = t("orderedAt", { time: clock(generatedAt) });
  else if (!available) status = t("needsConnection");

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOrder}
          disabled={loading || !available}
          title={t("evidence")}
          className="h-7 gap-1.5 rounded-full px-2.5 text-xs font-medium shadow-none"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-gold-text" aria-hidden />
          )}
          {ordered ? t("orderAgain") : t("order")}
        </Button>
        {ordered && !loading ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground shadow-none"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            {t("reset")}
          </Button>
        ) : null}
        {notConfigured ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 rounded-full px-2.5 text-xs font-medium shadow-none"
          >
            <Link to="/settings">{t("setUp")}</Link>
          </Button>
        ) : null}
      </div>
      {status ? (
        <p
          role="status"
          className={
            error
              ? "text-xs text-destructive"
              : "font-mono text-[11px] tabular-nums text-muted-foreground"
          }
        >
          {status}
        </p>
      ) : null}
      {ordered && !error && !loading ? (
        <p className="text-[11px] text-muted-foreground">
          {stale ? t("stale") : t("evidence")}
        </p>
      ) : null}
    </div>
  );
}
