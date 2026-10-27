import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { aiGradientLinear } from "@/lib/ai/ai-visual";
import { patchActivity } from "@/lib/sync/mutate-synced";
import { useJournalLetter } from "@/hooks/use-journal-letter";

/**
 * The weekly letter under the insight hero (product-scope.md §2.12). Tier 2:
 * a gradient edge on paper, so the hero stays the one full-bleed surface.
 * Renders nothing when journal reading is off.
 */
export default function HomeJournalLetter() {
  const { t } = useTranslation("home");
  const {
    phase,
    letter,
    stale,
    refreshing,
    notice,
    refresh,
    dismissExperiment,
  } = useJournalLetter();
  const [pendingPin, setPendingPin] = useState<string | null>(null);

  if (phase === "off") return null;

  const experiment =
    letter?.experiment && !letter.experimentDismissed
      ? letter.experiment
      : null;
  const habit = experiment?.habitKey
    ? letter?.habits.find((item) => item.key === experiment.habitKey)
    : undefined;

  const pin = async (activityId: string) => {
    setPendingPin(activityId);
    try {
      await patchActivity(activityId, { is_pinned: true });
    } finally {
      setPendingPin(null);
    }
  };

  return (
    <section
      aria-labelledby="home-letter-heading"
      className="rounded-[1.25rem] border-[1.5px] border-transparent bg-paper p-5"
      style={{
        backgroundImage: `linear-gradient(hsl(var(--paper)), hsl(var(--paper))), ${aiGradientLinear}`,
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          id="home-letter-heading"
          className="flex items-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          <Sparkles className="text-gold" aria-hidden />
          {stale ? t("letter.labelOlder") : t("letter.label")}
        </p>
        {phase === "ready" || phase === "quiet" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={refresh}
          >
            {refreshing ? t("letter.refreshing") : t("letter.refresh")}
          </Button>
        ) : null}
      </div>

      {phase === "loading" ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {t("loading")}
        </p>
      ) : null}

      {phase === "not-configured" ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("letter.needsKey")}{" "}
          <Link to="/settings?panel=ai" className="underline">
            {t("setup.cta")}
          </Link>
        </p>
      ) : null}

      {phase === "offline" ? (
        <p
          className="mt-3 text-sm leading-6 text-muted-foreground"
          role="status"
        >
          {t("letter.offline")}
        </p>
      ) : null}

      {phase === "error" ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-6 text-muted-foreground" role="alert">
            {notice || t("letter.error")}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            {t("letter.retry")}
          </Button>
        </div>
      ) : null}

      {phase === "quiet" ? (
        <div className="mt-3 space-y-3">
          <p className="font-display text-lg leading-snug">
            {letter?.sent ? t("letter.ungrounded") : t("letter.quiet")}
          </p>
          {letter?.sent ? (
            <p className="text-xs leading-5 text-muted-foreground">
              {t("letter.disclosure")}
            </p>
          ) : null}
        </div>
      ) : null}

      {phase === "ready" && letter ? (
        <div className="mt-3 space-y-4">
          {letter.paragraphs.map((paragraph) => {
            const dates = [
              ...new Set(paragraph.quotes.map((item) => item.date)),
            ];
            return (
              <div key={paragraph.text} className="space-y-2">
                <p className="font-display text-lg leading-snug">
                  {paragraph.text}
                </p>
                {dates.length > 0 ? (
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {dates.map((date) => (
                      <Link
                        key={date}
                        to={`/journal?focus=${encodeURIComponent(date)}`}
                        className="underline"
                      >
                        {t("letter.openDay", { date })}
                      </Link>
                    ))}
                  </p>
                ) : null}
              </div>
            );
          })}

          {experiment ? (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                {t("letter.experiment")}
              </p>
              <p className="text-sm leading-6">{experiment.text}</p>
              <div className="flex flex-wrap gap-2">
                {habit ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/">
                      {t("letter.openToday", { name: habit.name })}
                    </Link>
                  </Button>
                ) : null}
                {habit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pendingPin === habit.id}
                    onClick={() => void pin(habit.id)}
                  >
                    {t("digest.pinLabel", { name: habit.name })}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={dismissExperiment}
                >
                  {t("letter.dismiss")}
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-xs leading-5 text-muted-foreground">
            {t("letter.disclosure")}
          </p>
          {notice ? (
            <p
              className="text-xs leading-5 text-muted-foreground"
              role="status"
            >
              {notice}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
