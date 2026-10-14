import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InsightNotice } from "@/hooks/use-home-insight";

type State =
  | { phase: "loading" }
  | { phase: "offline" }
  | { phase: "not-configured" }
  | { phase: "error"; notice: InsightNotice | null };

interface HomeInsightStateProps {
  state: State;
  onRetry: () => void;
}

/**
 * Home when there is no insight to show: still loading, offline, no AI key, or
 * the AI failed. The full-bleed gradient is reserved for an actual insight
 * (tier 1), so these are plain paper cards with the small AI mark (tier 3). Each
 * one says that the rest of Home works without it.
 */
export default function HomeInsightState({
  state,
  onRetry,
}: HomeInsightStateProps) {
  const { t } = useTranslation("home");

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      role={state.phase === "loading" ? undefined : "status"}
      aria-busy={state.phase === "loading"}
    >
      <p className="flex items-center gap-1.5 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
        <Sparkles className="size-3.5 text-gold-text" aria-hidden />
        {t("hero.label")}
      </p>

      {state.phase === "loading" ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : null}

      {state.phase === "offline" ? (
        <>
          <p className="text-sm font-medium">{t("offline.title")}</p>
          <p className="text-sm text-muted-foreground">
            {t("offline.description")}
          </p>
        </>
      ) : null}

      {state.phase === "not-configured" ? (
        <>
          <p className="text-sm font-medium">{t("setup.title")}</p>
          <p className="text-sm text-muted-foreground">
            {t("setup.description")}
          </p>
          <Button asChild size="sm" className="h-11 md:h-8">
            <Link to="/settings">{t("setup.cta")}</Link>
          </Button>
        </>
      ) : null}

      {state.phase === "error" ? (
        <>
          <p className="text-sm font-medium">
            {state.notice?.kind === "rate-limited"
              ? t("error.rateLimitedTitle")
              : t("error.title")}
          </p>
          <p className="text-sm text-muted-foreground">
            {state.notice && "message" in state.notice
              ? state.notice.message
              : t("error.unknown")}
          </p>
          {state.notice?.kind === "rate-limited" ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 md:h-8"
              onClick={onRetry}
            >
              {t("hero.refresh")}
            </Button>
          )}
        </>
      ) : null}

      {state.phase !== "loading" ? (
        <p className="text-xs text-muted-foreground">{t("worksWithout")}</p>
      ) : null}
    </section>
  );
}
