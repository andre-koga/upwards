import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { FEATURE_RELEASES } from "@/lib/feature-releases";
import { releaseText } from "@/lib/feature-releases-pt";
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
  const { t, i18n } = useTranslation("nav");

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  return (
    <AppPageShell
      title={t("whatsNew")}
      subtitle={t("whatsNewPage.subtitle")}
      align="center"
    >
      <ol className="space-y-12 px-3 pt-2">
        {FEATURE_RELEASES.map((release) => {
          const text = releaseText(release, i18n.language);
          return (
            <li key={release.id}>
              <p className="text-[0.75rem] font-medium uppercase tabular-nums tracking-[0.12em] text-muted-foreground">
                <time dateTime={release.date}>
                  {formatReleaseDate(release.date)}
                </time>
              </p>
              <h2 className="mt-2 font-display text-[1.5rem] font-medium leading-snug tracking-[-0.01em] text-foreground">
                {text.title}
              </h2>
              <ul className="mt-3 space-y-2 text-[0.9375rem] leading-relaxed text-foreground/80">
                {text.bullets.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span
                      className="mt-[0.7em] h-px w-3 shrink-0 bg-foreground/30"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {text.fixes != null && text.fixes.length > 0 && (
                <div className="mt-5 rounded-2xl bg-muted/45 px-4 py-3.5">
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {t("whatsNewPage.bugFixes")}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
                    {text.fixes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <FloatingBackButton to="/settings" title={t("settings")} />
    </AppPageShell>
  );
}
