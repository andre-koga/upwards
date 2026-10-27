import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { IdentitySection } from "@/components/compass/identity-section";
import { AppRefreshActions } from "@/components/pwa/app-refresh-actions";
import { GoalsSection } from "@/components/compass/goals-section";
import { KnowledgeSection } from "@/components/compass/knowledge-section";
import { NorthStarSection } from "@/components/compass/north-star-section";
import { ParkedSection } from "@/components/compass/parked-section";
import { YouLinks } from "@/components/compass/you-links";
import { useCompassPage } from "@/hooks/use-compass-page";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";

/**
 * The compass (product-scope.md B5b-2). Written by the person: a north star,
 * identity words, goals, and notes. A goal's number, when it has one, is what
 * the record says. Check-ins and "what works for you" are not this page.
 */
export default function YouPage() {
  const { t } = useTranslation("you");
  const { ready, snapshot, activities, groups, weeks } = useCompassPage();

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  return (
    <div className="space-y-8 px-2 py-4 pb-24 md:p-4 md:pb-24">
      <header className="space-y-2 px-2 md:px-0">
        <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="max-w-md font-display text-[clamp(1.9rem,4vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
          {t("title")}
        </h1>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          {t("subtitle")}
        </p>
      </header>

      {ready ? (
        <>
          <NorthStarSection northStar={snapshot.northStar} />
          <IdentitySection words={snapshot.identity} />
          <GoalsSection
            goals={snapshot.goals}
            activities={activities}
            groups={groups}
            weeks={weeks}
          />
          <KnowledgeSection entries={snapshot.knowledge} />
          <ParkedSection
            archived={snapshot.archived}
            deleted={snapshot.deleted}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          {t("loading")}
        </p>
      )}

      <YouLinks />
      <AppRefreshActions />
    </div>
  );
}
