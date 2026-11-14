import { useTranslation } from "react-i18next";
import { AnimalPicture } from "@/components/you/animal-picture";
import { RadarChart } from "@/components/you/radar-chart";
import { TRAITS, type Trait, type TraitScores } from "@/lib/personality/items";
import { groupPairColors, animalType } from "@/lib/personality/animal-type";
import { traitColor } from "@/lib/personality/trait-colors";

interface ArchetypeHeroProps {
  self: TraitScores;
  journal: TraitScores | null;
  last: TraitScores | null;
  choices: Partial<Record<Trait, number>> | null;
}

/** The two traits furthest from the middle; they tint the radar shape. */
function standoutPair(scores: TraitScores): [Trait, Trait] {
  const ranked = [...TRAITS].sort(
    (a, b) => Math.abs(scores[b] - 50) - Math.abs(scores[a] - 50)
  );
  return [ranked[0], ranked[1]];
}

/**
 * Fades the wash in from nothing: the first 2.5rem is exactly the page
 * background (so the top of the screen never shows a tint), then it eases in
 * over about ten rem on a smooth curve, with no visible start line.
 */
const WASH_FADE = `linear-gradient(to bottom, ${[
  [0, 0],
  [2.5, 0],
  [3.5, 0.02],
  [4.5, 0.07],
  [5.5, 0.15],
  [6.5, 0.27],
  [7.5, 0.42],
  [8.5, 0.58],
  [9.5, 0.73],
  [10.5, 0.86],
  [11.5, 0.95],
  [12.5, 1],
]
  .map(([rem, alpha]) => `rgba(0, 0, 0, ${alpha}) ${rem}rem`)
  .join(", ")})`;

/**
 * The headline: a five-letter code, a one-word animal and a colour group,
 * all read from the five scores, then the shape of the scores.
 */
export function ArchetypeHero({
  self,
  journal,
  last,
  choices,
}: ArchetypeHeroProps) {
  const { t } = useTranslation("personality");
  const type = animalType(self);
  const tint = standoutPair(self);
  // Each group has its own pair of wash colours: one circle above the other.
  const [upper, lower] = groupPairColors(type.group, 0.32);

  return (
    <>
      <section
        aria-labelledby="your-type"
        className="relative -mx-4 px-4 pb-8 pt-3 text-center"
      >
        {/* The wash belongs to the page: it sits behind everything and runs past
          the end of this section, so the first trait cards sit on it too. It
          reaches up behind the masthead and fades to nothing at its top, so
          there is no edge for the installed app's status bar to cut across. The
          top of the page is exactly the plain background. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -bottom-64 -top-40 -z-10"
          style={{
            background: [
              `radial-gradient(circle 27rem at 50% 20rem, ${upper} 0%, transparent 100%)`,
              `radial-gradient(circle 29rem at 50% 38rem, ${lower} 0%, transparent 100%)`,
            ].join(", "),
            maskImage: WASH_FADE,
            WebkitMaskImage: WASH_FADE,
          }}
        />

        <div className="relative">
          <AnimalPicture
            id={type.id}
            className="mx-auto h-auto max-h-48 w-48"
          />

          <h2
            id="your-type"
            className="mx-auto mt-3 max-w-[20rem] font-display text-[3.5rem] italic leading-[1.05] tracking-[-0.02em] text-foreground"
          >
            {t(`type.names.${type.id}.name`)}
          </h2>

          <p className="mt-2">
            <span className="sr-only">
              {t("type.codeLabel")}: {type.code}
            </span>
            <span
              aria-hidden="true"
              className="pl-[0.08em] font-display text-[1.375rem] leading-none tracking-[0.08em] text-muted-foreground"
            >
              {type.code}
            </span>
          </p>

          <p className="mx-auto mt-4 w-fit max-w-full rounded-3xl border border-foreground/20 bg-foreground/5 px-3.5 py-1.5 text-[0.8125rem] leading-snug backdrop-blur-sm">
            <span className="font-medium text-foreground">
              {t(`type.groups.${type.group}.name`)}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              {" · "}
            </span>
            <span className="text-muted-foreground">
              {t(`type.groups.${type.group}.tagline`)}
            </span>
          </p>

          <p className="mx-auto mt-4 max-w-[22rem] font-display text-[1.0625rem] leading-relaxed text-foreground/80">
            {t(`type.names.${type.id}.blurb`)}
          </p>

          <div className="mt-4">
            <p className="text-xs text-muted-foreground">{t("type.letters")}</p>
            <ul className="mt-1.5 flex flex-wrap justify-center gap-2">
              {type.letters.map(({ trait, pole, letter }) => (
                <li
                  key={trait}
                  className="flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1 text-[0.8125rem] backdrop-blur-sm"
                  style={{ borderColor: traitColor(trait, 0.5) }}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ background: traitColor(trait) }}
                  />
                  <span className="font-medium">{letter}</span>
                  {t(`type.poles.${trait}.${pole}`)}
                  <span className="tabular-nums text-muted-foreground">
                    {self[trait]}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <RadarChart
              self={self}
              journal={journal}
              last={last}
              choices={choices}
              tint={tint}
            />
          </div>

          {(journal || choices || last) && (
            <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              {journal && (
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-0 w-4 border-t-2 border-dashed border-foreground"
                  />
                  {t("result.journal")}
                </li>
              )}
              {choices && (
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="size-2 rotate-45 border-2 border-foreground"
                  />
                  {t("result.choices")}
                </li>
              )}
              {last && (
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-0 w-4 border-t-2 border-dotted border-muted-foreground/70"
                  />
                  {t("result.lastTime")}
                </li>
              )}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
