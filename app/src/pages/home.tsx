import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { AppPageShell } from "@/components/layout/app-page-shell";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import HomeAiSuggestions from "@/components/home/home-ai-suggestions";
import HomeDigest from "@/components/home/home-digest";
import HomeInsightHero from "@/components/home/home-insight-hero";
import HomeInsightState from "@/components/home/home-insight-state";
import { useHomeDigest } from "@/hooks/use-home-digest";
import { useHomeInsight } from "@/hooks/use-home-insight";
import { parseInsightFigures } from "@/lib/ai/build-insight-payload";
import { patchActivity } from "@/lib/sync/mutate-synced";

/** True while the key press belongs to something else: a field, or an open dialog. */
function keyIsForSomethingElse(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  ) {
    return true;
  }
  return document.querySelector('[role="dialog"]') !== null;
}

export default function HomePage() {
  const { t } = useTranslation("home");
  const { t: tNav } = useTranslation("nav");
  const { phase, insight, stale, refreshing, notice, refresh } =
    useHomeInsight();
  const { digest, reload: reloadDigest } = useHomeDigest();
  const [pendingPin, setPendingPin] = useState<string | null>(null);

  const pin = async (activityId: string) => {
    setPendingPin(activityId);
    try {
      await patchActivity(activityId, { is_pinned: true });
      await reloadDigest();
    } finally {
      setPendingPin(null);
    }
  };

  const showInsight =
    insight !== null && (phase === "ready" || phase === "error");

  // `R` asks for a new insight, as the design document lists. The button does
  // the same for everyone who is not on a keyboard.
  useEffect(() => {
    if (!showInsight) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r" || keyIsForSomethingElse(event))
        return;
      event.preventDefault();
      refresh();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showInsight, refresh]);

  const digestSection = digest ? (
    <HomeDigest
      items={digest.items}
      trackedHabits={digest.trackedHabits}
      pendingId={pendingPin}
      onPin={(id) => void pin(id)}
    />
  ) : null;

  return (
    <AppPageShell
      title={t("page.title")}
      titleIcon={<Sparkles className="size-5 text-primary" aria-hidden />}
      subtitle={t("page.subtitle")}
      className="space-y-4"
    >
      {showInsight ? (
        <>
          <HomeInsightHero
            insight={insight}
            stale={stale}
            refreshing={refreshing}
            notice={notice}
            onRefresh={refresh}
          />
          {digestSection}
          <HomeAiSuggestions
            suggestions={insight.suggestions ?? []}
            legacy={insight.recommendations}
            generatedAt={insight.generatedAt}
            figures={parseInsightFigures(insight.fingerprint)}
            habits={digest?.habits ?? []}
            stale={stale}
            pendingId={pendingPin}
            onPin={(id) => void pin(id)}
          />
        </>
      ) : (
        <>
          {/* No insight to lead with: the digest is the screen, and the AI is
              an offer below it, never a gate in front of it. */}
          {digestSection}
          <HomeInsightState
            state={
              phase === "error"
                ? { phase, notice }
                : phase === "ready"
                  ? { phase: "loading" }
                  : { phase }
            }
            onRetry={refresh}
          />
        </>
      )}

      <FloatingBackButton to="/" title={tNav("home")} />
    </AppPageShell>
  );
}
