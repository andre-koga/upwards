import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { IdentitySection } from "@/components/compass/identity-section";
import { GoalsSection } from "@/components/compass/goals-section";
import { KnowledgeSection } from "@/components/compass/knowledge-section";
import { NorthStarSection } from "@/components/compass/north-star-section";
import { ParkedSection } from "@/components/compass/parked-section";
import { YouLinks } from "@/components/compass/you-links";
import { TabPageShell } from "@/components/layout/tab-page-shell";
import { useCompassPage } from "@/hooks/use-compass-page";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";

/**
 * The compass (product-scope.md B5b-2). Written by the person: a north star,
 * identity words, goals, and notes. A goal's number, when it has one, is what
 * the record says. Check-ins and "what works for you" are not this page.
 */
export default function YouPage() {
  const { t } = useTranslation("you");
  const { t: tNav } = useTranslation("nav");
  const { ready, snapshot, activities, groups, weeks } = useCompassPage();

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  return (
    <TabPageShell title={tNav("tabs.you")} contentClassName="space-y-8">
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
    </TabPageShell>
  );
}
