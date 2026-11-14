import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArchetypeHero } from "@/components/you/archetype-hero";
import { TraitTrack } from "@/components/you/trait-track";
import type { JournalReading, PersonalitySitting } from "@/lib/db/types";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  BEHAVIOUR_RANGES,
  type Behaviour,
  type BehaviourRange,
} from "@/lib/personality/behaviour";
import { band, gapDirection } from "@/lib/personality/bands";
import { journalComparison } from "@/lib/personality/highlights";
import { TRAITS, type Trait } from "@/lib/personality/items";
import { traitColor } from "@/lib/personality/trait-colors";
import { formatDateShort } from "@/lib/time-utils";

interface PersonalityResultProps {
  latest: PersonalitySitting;
  previous: PersonalitySitting | null;
  reading: JournalReading | null;
  behaviour: Behaviour | null;
  range: BehaviourRange;
  onRangeChange: (range: BehaviourRange) => void;
  /** The portrait site: no habits, and no quotes page to open. */
  portraitOnly?: boolean;
}

function TraitDot({ trait }: { trait: Trait }) {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-full"
      style={{ background: traitColor(trait) }}
    />
  );
}

/** The portrait: a headline type and radar, then one coloured card per trait. */
export function PersonalityResult({
  latest,
  previous,
  reading,
  behaviour,
  range,
  onRangeChange,
  portraitOnly = false,
}: PersonalityResultProps) {
  const { t } = useTranslation("personality");
  const scores = latest.scores;
  if (!scores) return null;

  const comparison = reading ? journalComparison(scores, reading.scores) : null;
  const highlights: Array<{ key: "closest" | "widest"; trait: Trait }> = [];
  if (comparison) {
    highlights.push({ key: "closest", trait: comparison.closest });
    if (comparison.widest) {
      highlights.push({ key: "widest", trait: comparison.widest });
    }
  }

  // Habits can only speak to some traits; the rest are left out, not guessed.
  const behaviourScores: Partial<Record<Trait, number>> | null =
    behaviour && !portraitOnly
      ? {
          openness: behaviour.openness,
          conscientiousness: behaviour.conscientiousness,
        }
      : null;
  const quoteCount = reading
    ? TRAITS.reduce(
        (sum, trait) => sum + (reading.quotes[trait]?.length ?? 0),
        0
      )
    : 0;

  return (
    <div className="space-y-6 px-2 pt-2">
      <ArchetypeHero
        self={scores}
        journal={reading?.scores ?? null}
        last={previous?.scores ?? null}
        behaviour={behaviourScores}
        daysRead={reading?.days_read ?? null}
        takenOn={
          latest.completed_at
            ? formatDateShort(new Date(latest.completed_at))
            : null
        }
      />

      {highlights.length > 0 && (
        <ul
          className={
            highlights.length > 1 ? "grid grid-cols-2 gap-3" : "grid gap-3"
          }
        >
          {highlights.map(({ key, trait }) => (
            <li
              key={key}
              className="rounded-2xl border px-3.5 py-3"
              style={{
                borderColor: traitColor(trait, 0.4),
                background: `linear-gradient(135deg, ${traitColor(trait, 0.18)}, transparent)`,
              }}
            >
              <p className="text-xs text-muted-foreground">
                {t(`result.highlights.${key}`)}
              </p>
              <p className="mt-1 flex items-center gap-2 font-display text-[1.0625rem] text-foreground">
                <TraitDot trait={trait} />
                {t(`traits.${trait}.name`)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <ul className="space-y-4">
        {TRAITS.map((trait) => {
          const self = scores[trait];
          const journal = reading ? reading.scores[trait] : null;
          const last = previous?.scores ? previous.scores[trait] : null;
          const gap = journal === null ? null : gapDirection(self, journal);
          const level = band(self);
          const note = reading?.notes[trait];
          const habit = behaviourScores?.[trait] ?? null;
          const word =
            level === "mid"
              ? t("result.balancedWord")
              : t(`traits.${trait}.${level}`);

          return (
            <li
              key={trait}
              className="rounded-3xl border px-4 pb-4 pt-4"
              style={{
                borderColor: traitColor(trait, 0.35),
                background: `linear-gradient(160deg, ${traitColor(trait, 0.16)} 0%, transparent 70%)`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-display text-[1.1875rem] text-foreground">
                    <TraitDot trait={trait} />
                    {t(`traits.${trait}.name`)}
                  </h3>
                  <p
                    className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-foreground"
                    style={{ background: traitColor(trait, 0.22) }}
                  >
                    {word}
                  </p>
                </div>
                <p
                  aria-hidden="true"
                  className="font-display text-[2.5rem] tabular-nums leading-none tracking-[-0.03em] text-foreground"
                >
                  {self}
                </p>
              </div>

              <div className="mt-4">
                <TraitTrack
                  trait={trait}
                  self={self}
                  journal={journal}
                  last={last}
                  behaviour={habit}
                />
              </div>

              <p className="mt-3 font-display text-[1.0625rem] leading-relaxed text-foreground/85">
                {t(`result.bands.${trait}.${level}`)}
              </p>
              {gap !== null && (
                <p className="mt-2 flex items-start gap-2 text-[0.9375rem] leading-relaxed text-foreground/75">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-3 shrink-0 rounded-full border-[3px] border-foreground"
                  />
                  {t(`result.gap.${gap}`, {
                    trait: t(`traits.${trait}.name`),
                    adjective: t(`traits.${trait}.adjective`),
                  })}
                </p>
              )}
              {habit !== null && behaviour && (
                <p className="mt-2 flex items-start gap-2 text-[0.9375rem] leading-relaxed text-foreground/75">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2.5 shrink-0 rotate-45 border-2 border-foreground"
                  />
                  {trait === "conscientiousness"
                    ? t("result.habits.conscientiousness", {
                        active: behaviour.detail.activeDays,
                        total: behaviour.detail.countedDays,
                      })
                    : t("result.habits.openness", {
                        activities: t("result.habits.activities", {
                          count: behaviour.detail.activities,
                        }),
                        places: t("result.habits.places", {
                          count: behaviour.detail.places,
                        }),
                      })}
                </p>
              )}
              {note && (
                <div
                  className="mt-3 border-l-2 pl-3 text-[0.875rem] leading-relaxed text-muted-foreground"
                  style={{ borderColor: traitColor(trait, 0.7) }}
                >
                  <p>
                    <span className="font-medium text-foreground/80">
                      {t("journal.noteLabel")}:
                    </span>{" "}
                    {note}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!portraitOnly && (
        <section aria-labelledby="habits-range" className="space-y-3 px-2">
          <h3
            id="habits-range"
            className="text-center text-sm text-foreground/85"
          >
            {t("habitsRange.label")}
          </h3>
          <SegmentedControl
            aria-labelledby="habits-range"
            value={String(range)}
            onValueChange={(value) =>
              onRangeChange(Number(value) as BehaviourRange)
            }
          >
            {BEHAVIOUR_RANGES.map((days) => (
              <SegmentedControlItem key={days} value={String(days)}>
                {t("habitsRange.option", { count: days })}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            {behaviour
              ? t("result.habitsNote", { days: behaviour.detail.windowDays })
              : t("habitsRange.empty")}
          </p>
        </section>
      )}

      {quoteCount > 0 && !portraitOnly && (
        <Link
          to="/you/words"
          className="mx-auto flex w-fit items-center rounded-full border border-foreground/15 bg-background/60 px-4 py-2 text-sm text-foreground/85 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("words.open", { count: quoteCount })}
        </Link>
      )}
    </div>
  );
}
