import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiGradient, onAi } from "@/lib/ai/ai-visual";
import { parseInsightFigures } from "@/lib/ai/build-insight-payload";
import type { CachedInsight } from "@/lib/ai/insight-cache";
import type { InsightNotice } from "@/hooks/use-home-insight";
import { formatSyncTime } from "@/lib/time-utils";

interface HomeInsightHeroProps {
  insight: CachedInsight;
  /** Made from numbers that have since changed, or over a day old. */
  stale: boolean;
  refreshing: boolean;
  notice: InsightNotice | null;
  onRefresh: () => void;
}

/**
 * The Home insight: the one full-bleed AI surface on the screen (tier 1,
 * design-and-branding.md §4.2). Near-white text on the dark gradient in both
 * themes. It names its evidence and where the numbers went, can show the
 * numbers it was made from, says plainly when it is older, and offers the next
 * step. The rest of Home works without it.
 */
export default function HomeInsightHero({
  insight,
  stale,
  refreshing,
  notice,
  onRefresh,
}: HomeInsightHeroProps) {
  const { t } = useTranslation("home");
  const [showNumbers, setShowNumbers] = useState(false);
  const figures = parseInsightFigures(insight.fingerprint);
  const noticeText =
    notice?.kind === "offline"
      ? t("notice.offline")
      : notice
        ? notice.message
        : stale
          ? t("notice.stale")
          : null;

  return (
    <section
      aria-labelledby="home-insight-heading"
      className="relative overflow-hidden rounded-[1.75rem] p-5 shadow-[0_20px_50px_rgba(40,69,58,0.28)] sm:p-7"
      style={{ backgroundImage: aiGradient, color: onAi }}
    >
      {/* Two soft glows from palette colors, not hard rings. */}
      <div
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-gold/50 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-lavender/40 blur-3xl"
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.14em] opacity-85">
            <Sparkles className="size-3.5 text-gold" aria-hidden />
            <span>
              {stale ? t("hero.labelOlder") : t("hero.label")}
              {" · "}
              {refreshing
                ? t("hero.refreshing")
                : t("hero.refreshedAt", {
                    time: formatSyncTime(insight.generatedAt),
                  })}
            </span>
          </p>
          <div className="flex items-center gap-1.5">
            <kbd
              aria-hidden
              className="hidden rounded border border-white/25 px-1.5 py-0.5 font-mono text-[11px] leading-none opacity-80 lg:inline"
            >
              R
            </kbd>
            <Button
              type="button"
              variant="bare"
              size="iconRoundMd"
              className="size-11 border border-white/25 bg-white/10 hover:bg-white/20 disabled:bg-white/10 disabled:text-inherit disabled:opacity-60 md:size-9"
              style={{ color: onAi }}
              disabled={refreshing}
              onClick={onRefresh}
              aria-label={t("hero.refresh")}
              aria-keyshortcuts="R"
              title={t("hero.refresh")}
            >
              <RefreshCw
                className={refreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden
              />
            </Button>
          </div>
        </div>

        <h2
          id="home-insight-heading"
          className="mt-5 max-w-lg font-display text-[clamp(1.7rem,4.4vw,2.5rem)] leading-[1.12] tracking-[-0.02em]"
        >
          {insight.summary}
        </h2>

        {noticeText ? (
          <p
            role="status"
            className="mt-4 max-w-lg rounded-lg border border-white/25 bg-black/20 px-3 py-2 text-xs leading-5"
          >
            {noticeText}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="bare"
            className="h-11 rounded-full bg-[hsl(var(--on-ai))] px-4 text-xs font-semibold text-[hsl(var(--ai-ink))] hover:bg-[hsl(var(--on-ai)/0.88)] md:h-9"
          >
            <Link to="/">{t("hero.openToday")}</Link>
          </Button>
          {figures ? (
            <Button
              type="button"
              variant="bare"
              className="h-11 rounded-full border border-white/25 bg-transparent px-4 text-xs font-semibold hover:bg-white/10 md:h-9"
              style={{ color: onAi }}
              aria-expanded={showNumbers}
              aria-controls="home-insight-numbers"
              onClick={() => setShowNumbers((open) => !open)}
            >
              {showNumbers ? t("hero.hideNumbers") : t("hero.seeNumbers")}
            </Button>
          ) : null}
        </div>

        {showNumbers && figures ? (
          <div
            id="home-insight-numbers"
            className="mt-4 space-y-2 rounded-xl border border-white/20 bg-black/20 p-3 text-xs leading-5"
          >
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] opacity-85">
              {t("evidence.title")}
            </p>
            <ul className="space-y-1 font-mono tabular-nums">
              <li>
                {t("evidence.completion", {
                  percent: Math.round(figures.completionRate * 100),
                  days: parseInt(figures.range, 10) || 7,
                })}
              </li>
              {figures.activities.map((activity, index) => (
                <li key={`${index}-${activity.name}`}>
                  {t("evidence.activity", {
                    name: activity.name,
                    done: activity.completedDays,
                    total: activity.totalDays,
                    streak: activity.streak,
                  })}
                </li>
              ))}
              <li>
                {t("evidence.journal", {
                  entries: figures.journal.entriesThisWeek,
                  streak: figures.journal.streak,
                })}
              </li>
            </ul>
            <p className="opacity-85">{t("evidence.sent")}</p>
          </div>
        ) : null}

        <p className="mt-5 text-[0.68rem] opacity-85">{t("hero.basedOn")}</p>
      </div>
    </section>
  );
}
