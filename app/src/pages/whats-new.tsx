import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { SectionLabel } from "@/components/ui/section-label";
import { FEATURE_RELEASES } from "@/lib/feature-releases";
import { getActiveLocaleTag } from "@/lib/i18n";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";

function formatReleaseDate(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString(getActiveLocaleTag(), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function WhatsNewPage() {
  const { t } = useTranslation("nav");

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  return (
    <AppPageShell title={t("whatsNew")} subtitle={t("whatsNewPage.subtitle")}>
      <ol className="space-y-8 border-l border-border pl-4">
        {FEATURE_RELEASES.map((release) => (
          <li key={release.id} className="relative">
            <span
              className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
              aria-hidden
            />
            <SectionLabel className="font-medium">
              {formatReleaseDate(release.date)}
            </SectionLabel>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              {release.title}
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {release.bullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {release.fixes != null && release.fixes.length > 0 && (
              <div className="mt-4">
                <SectionLabel>{t("whatsNewPage.bugFixes")}</SectionLabel>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                  {release.fixes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>

      <FloatingBackButton to="/" title={t("home")} />
    </AppPageShell>
  );
}
