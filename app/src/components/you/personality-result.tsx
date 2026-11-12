import { useTranslation } from "react-i18next";
import { TraitTrack } from "@/components/you/trait-track";
import type { JournalReading, PersonalitySitting } from "@/lib/db/types";
import { band, gapDirection } from "@/lib/personality/bands";
import { TRAITS } from "@/lib/personality/items";
import { formatDateShort } from "@/lib/time-utils";

interface PersonalityResultProps {
  latest: PersonalitySitting;
  previous: PersonalitySitting | null;
  reading: JournalReading | null;
}

function Legend({ journal, last }: { journal: boolean; last: boolean }) {
  const { t } = useTranslation("personality");
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
        {t("result.you")}
      </li>
      {journal && (
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full border-2 border-terracotta"
          />
          {t("result.journal")}
        </li>
      )}
      {last && (
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-px bg-muted-foreground/70"
          />
          {t("result.lastTime")}
        </li>
      )}
    </ul>
  );
}

/** Five tracks, one per trait, with what the answers say and how the journal compares. */
export function PersonalityResult({
  latest,
  previous,
  reading,
}: PersonalityResultProps) {
  const { t } = useTranslation("personality");
  const scores = latest.scores;
  if (!scores) return null;

  return (
    <section aria-labelledby="portrait" className="px-4 pt-4">
      <div className="text-center">
        <h2
          id="portrait"
          className="font-display text-[1.625rem] italic leading-snug tracking-[-0.01em] text-foreground/85"
        >
          {t("result.heading")}
        </h2>
        {latest.completed_at && (
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            {t("result.takenOn", {
              date: formatDateShort(new Date(latest.completed_at)),
            })}
          </p>
        )}
      </div>

      <div className="mt-5">
        <Legend journal={reading !== null} last={previous?.scores != null} />
      </div>

      <ul className="mt-6 space-y-8">
        {TRAITS.map((trait) => {
          const self = scores[trait];
          const journal = reading ? reading.scores[trait] : null;
          const last = previous?.scores ? previous.scores[trait] : null;
          const gap = journal === null ? null : gapDirection(self, journal);
          const note = reading?.notes[trait];
          const quotes = reading?.quotes[trait] ?? [];

          return (
            <li key={trait}>
              <TraitTrack
                trait={trait}
                self={self}
                journal={journal}
                last={last}
              />
              <p className="mt-3 font-display text-[1.0625rem] leading-relaxed text-foreground/85">
                {t(`result.bands.${trait}.${band(self)}`)}
              </p>
              {gap !== null && (
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-terracotta-text">
                  {t(`result.gap.${gap}`, {
                    trait: t(`traits.${trait}.name`),
                    adjective: t(`traits.${trait}.adjective`),
                  })}
                </p>
              )}
              {(note || quotes.length > 0) && (
                <div className="mt-2 border-l-2 border-terracotta/60 pl-3 text-[0.875rem] leading-relaxed text-muted-foreground">
                  {note && (
                    <p>
                      <span className="font-medium text-foreground/80">
                        {t("journal.noteLabel")}:
                      </span>{" "}
                      {note}
                    </p>
                  )}
                  {quotes.length > 0 && (
                    <figure className="mt-1.5">
                      <figcaption className="text-xs">
                        {t("journal.quotesLabel")}
                      </figcaption>
                      {quotes.map((quote) => (
                        <blockquote
                          key={quote}
                          className="mt-1 font-display italic text-foreground/80"
                        >
                          “{quote}”
                        </blockquote>
                      ))}
                    </figure>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
        {t("disclaimer")}
      </p>
    </section>
  );
}
