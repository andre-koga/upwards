import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AppPageShell } from "@/components/layout/app-page-shell";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { useAsyncData } from "@/hooks/use-async-data";
import { db } from "@/lib/db";
import { TRAITS, type Trait } from "@/lib/personality/items";
import { latestJournalReading } from "@/lib/personality/journal-reading";
import { quoteSources, type QuoteSource } from "@/lib/personality/quotes";
import { traitColor } from "@/lib/personality/trait-colors";
import { scrollAppToTop } from "@/lib/scroll-app-to-top";
import { formatDateShort, fromDateString } from "@/lib/time-utils";

interface Words {
  groups: Array<{ trait: Trait; note: string | null; quotes: QuoteSource[] }>;
}

async function loadWords(): Promise<Words> {
  const [reading, entries] = await Promise.all([
    latestJournalReading(),
    db.journalEntries.toArray(),
  ]);
  const groups = TRAITS.map((trait) => ({
    trait,
    note: reading?.notes[trait] ?? null,
    quotes: quoteSources(reading?.quotes[trait] ?? [], entries),
  })).filter((group) => group.quotes.length > 0);
  return { groups };
}

/**
 * The lines from the journal that the reading leaned on, grouped by trait.
 * Every quote was checked word for word against a day that was sent, so each
 * one is something the person wrote.
 */
export default function YouWordsPage() {
  const { t } = useTranslation("personality");
  const { data } = useAsyncData<Words>(loadWords, []);

  useLayoutEffect(() => {
    scrollAppToTop();
  }, []);

  return (
    <AppPageShell
      title={t("words.title")}
      subtitle={t("words.subtitle")}
      align="center"
    >
      {data && data.groups.length === 0 && (
        <div className="mx-auto max-w-[20rem] space-y-4 px-4 pt-6 text-center">
          <p className="font-display text-[1.0625rem] leading-relaxed text-muted-foreground">
            {t("words.empty")}
          </p>
          <Link
            to="/you"
            className="inline-block rounded-full border border-foreground/15 px-4 py-2 text-sm text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("words.backToYou")}
          </Link>
        </div>
      )}

      <ul className="space-y-6 px-2 pb-24 pt-2">
        {data?.groups.map(({ trait, note, quotes }) => (
          <li
            key={trait}
            className="rounded-3xl border px-4 pb-4 pt-4"
            style={{
              borderColor: traitColor(trait, 0.35),
              background: `linear-gradient(160deg, ${traitColor(trait, 0.16)} 0%, transparent 70%)`,
            }}
          >
            <h2 className="flex items-center gap-2 font-display text-[1.1875rem] text-foreground">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: traitColor(trait) }}
              />
              {t("words.sounds", { trait: t(`traits.${trait}.name`) })}
            </h2>
            {note && (
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-muted-foreground">
                {note}
              </p>
            )}
            <ul className="mt-3 space-y-4">
              {quotes.map(({ quote, date }) => (
                <li
                  key={quote}
                  className="border-l-2 pl-3"
                  style={{ borderColor: traitColor(trait, 0.7) }}
                >
                  <blockquote className="font-display text-[1.0625rem] italic leading-relaxed text-foreground/90">
                    “{quote}”
                  </blockquote>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {date ? (
                      <Link
                        to={`/journal?focus=${date}`}
                        className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {t("words.fromDay", {
                          date: formatDateShort(fromDateString(date)),
                        })}
                      </Link>
                    ) : (
                      t("words.dayChanged")
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <FloatingBackButton to="/you" title={t("words.back")} />
    </AppPageShell>
  );
}
