import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";

/**
 * Who you are. Reflective, so editorial: the same centred masthead as the
 * Journal, and serif text set on the page rather than in a box. The portrait
 * is read from the record and does not exist yet, so the page says so instead
 * of showing something invented.
 */
export default function YouPage() {
  const { t } = useTranslation("you");

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  return (
    <AppPageShell title={t("title")} subtitle={t("eyebrow")} align="center">
      <section
        aria-labelledby="you-empty"
        className="mx-auto flex max-w-[20rem] flex-col items-center px-4 pt-10 text-center"
      >
        <h2
          id="you-empty"
          className="font-display text-[1.625rem] italic leading-snug tracking-[-0.01em] text-foreground/85"
        >
          {t("empty.heading")}
        </h2>
        <p className="mt-4 font-display text-[1.0625rem] leading-relaxed text-muted-foreground">
          {t("empty.body")}
        </p>
      </section>
    </AppPageShell>
  );
}
