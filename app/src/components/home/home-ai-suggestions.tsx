import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Pin, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InsightPayload } from "@/lib/ai/build-insight-payload";
import {
  dismissSuggestion,
  getDismissedSuggestions,
  suggestionId,
} from "@/lib/ai/insight-dismissed";
import type { InsightSuggestion } from "@/lib/ai/insight-response";

interface HomeAiSuggestionsProps {
  /** Suggestions tied to a habit, from the insight. */
  suggestions: readonly InsightSuggestion[];
  /** Plain suggestions from an insight made before they were tied to a habit. */
  legacy: readonly string[];
  /** When the insight was made; dismissals belong to one insight. */
  generatedAt: string;
  /** The figures the insight was made from, to show each suggestion's evidence. */
  figures: InsightPayload | null;
  /** The habits that exist and can be acted on now, and whether each is pinned. */
  habits: readonly { id: string; pinned: boolean }[];
  /** The insight is older than the numbers on this device. */
  stale: boolean;
  pendingId: string | null;
  onPin: (activityId: string) => void;
}

/**
 * What the person's own AI suggests: each suggestion is about one of their
 * habits, shows that habit's figures, and has something to do (pin it to the top
 * of Today, or open Today). The server keeps a suggestion only if its numbers are
 * that habit's own, so nothing here is invented. Any one can be set aside, and
 * the digest above works without any of this. The small AI mark (tier 3) is the
 * only AI styling: the gradient is for the insight itself.
 */
export default function HomeAiSuggestions({
  suggestions,
  legacy,
  generatedAt,
  figures,
  habits,
  stale,
  pendingId,
  onPin,
}: HomeAiSuggestionsProps) {
  const { t } = useTranslation("home");
  const [dismissed, setDismissed] = useState(getDismissedSuggestions);

  const shown = suggestions.filter(
    (suggestion) => !dismissed.has(suggestionId(generatedAt, suggestion.key))
  );
  const hasAny = suggestions.length > 0 || legacy.length > 0;
  if (!hasAny) return null;

  const habitById = new Map(habits.map((habit) => [habit.id, habit]));

  return (
    <section
      aria-labelledby="home-ai-suggestions-heading"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2
          id="home-ai-suggestions-heading"
          className="flex items-center gap-1.5 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          <Sparkles className="size-3.5 text-gold-text" aria-hidden />
          {t("suggestions.title")}
        </h2>
      </div>

      {suggestions.length > 0 && shown.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          {t("suggestions.allDismissed")}
        </p>
      ) : null}

      <ul className="divide-y divide-border">
        {shown.map((suggestion) => {
          const habit = habitById.get(suggestion.activityId);
          const id = suggestionId(generatedAt, suggestion.key);
          const habitFigures = figures?.activities.find(
            (activity) => activity.key === suggestion.key
          );
          return (
            <li key={id} className="space-y-2 px-4 py-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm leading-relaxed">{suggestion.text}</p>
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {suggestion.name}
                    {habitFigures
                      ? ` · ${t("suggestions.evidence", {
                          done: habitFigures.completedDays,
                          total: habitFigures.totalDays,
                          streak: habitFigures.streak,
                        })}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="smIcon"
                  className="size-11 shrink-0 text-muted-foreground md:size-8"
                  onClick={() => setDismissed(dismissSuggestion(id))}
                  aria-label={t("suggestions.dismissLabel", {
                    name: suggestion.name,
                  })}
                  title={t("suggestions.dismiss")}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
              <SuggestionAction
                name={suggestion.name}
                activityId={suggestion.activityId}
                habit={habit}
                pending={pendingId === suggestion.activityId}
                onPin={onPin}
              />
            </li>
          );
        })}

        {suggestions.length === 0
          ? legacy.map((text, index) => (
              <li
                key={`${index}-${text.slice(0, 24)}`}
                className="px-4 py-3 text-sm leading-relaxed"
              >
                {text}
              </li>
            ))
          : null}
      </ul>

      {suggestions.length === 0 ? (
        <div className="border-t border-border px-4 py-2">
          <Button asChild size="sm" variant="ghost" className="h-11 md:h-8">
            <Link to="/">{t("suggestions.openToday")}</Link>
          </Button>
        </div>
      ) : null}

      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {stale
          ? t("suggestions.stale")
          : suggestions.length > 0
            ? t("suggestions.grounded")
            : t("suggestions.written")}
      </p>
    </section>
  );
}

function SuggestionAction({
  name,
  activityId,
  habit,
  pending,
  onPin,
}: {
  name: string;
  activityId: string;
  habit: { id: string; pinned: boolean } | undefined;
  pending: boolean;
  onPin: (activityId: string) => void;
}) {
  const { t } = useTranslation("home");

  if (!habit) {
    // Archived or deleted since the insight was made: nothing to act on.
    return (
      <p className="text-xs text-muted-foreground">
        {t("suggestions.inactive")}
      </p>
    );
  }
  if (habit.pinned) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="size-3.5" aria-hidden />
          {t("digest.pinned")}
        </span>
        <Button asChild size="sm" variant="outline" className="h-11 md:h-8">
          <Link to="/">{t("digest.openToday")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-11 md:h-8"
      disabled={pending}
      onClick={() => onPin(activityId)}
      aria-label={t("digest.pinLabel", { name })}
    >
      <Pin className="size-3.5" aria-hidden />
      {t("digest.pin")}
    </Button>
  );
}
