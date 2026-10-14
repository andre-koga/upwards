import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HomeAiSuggestionsProps {
  suggestions: readonly string[];
  /** The insight is older than the numbers on this device. */
  stale: boolean;
}

/**
 * What the person's own AI suggests, as the model wrote it. Each line is the
 * model's text, so the section says so and marks it with the small AI mark
 * (tier 3), apart from the digest above it, which is computed here from the
 * numbers. Acting on one happens on Today.
 */
export default function HomeAiSuggestions({
  suggestions,
  stale,
}: HomeAiSuggestionsProps) {
  const { t } = useTranslation("home");
  if (suggestions.length === 0) return null;

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
        <Button asChild size="sm" variant="ghost" className="h-11 md:h-8">
          <Link to="/">{t("suggestions.openToday")}</Link>
        </Button>
      </div>
      <ul className="divide-y divide-border">
        {suggestions.map((suggestion, index) => (
          <li
            key={`${index}-${suggestion.slice(0, 24)}`}
            className="px-4 py-3 text-sm leading-relaxed"
          >
            {suggestion}
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {stale ? t("suggestions.stale") : t("suggestions.written")}
      </p>
    </section>
  );
}
