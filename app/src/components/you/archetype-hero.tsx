import { useTranslation } from "react-i18next";
import { RadarChart } from "@/components/you/radar-chart";
import type { TraitScores } from "@/lib/personality/items";
import { traitColor } from "@/lib/personality/trait-colors";
import { typeName } from "@/lib/personality/type-name";

interface ArchetypeHeroProps {
  self: TraitScores;
  journal: TraitScores | null;
  last: TraitScores | null;
  takenOn: string | null;
  /** Days the journal reading covered, when a reading exists. */
  daysRead: number | null;
}

/**
 * The headline: a type name drawn from the traits that stand furthest from the
 * middle, the shape of the five scores, and what the type is built from.
 */
export function ArchetypeHero({
  self,
  journal,
  last,
  takenOn,
  daysRead,
}: ArchetypeHeroProps) {
  const { t } = useTranslation("personality");
  const name = typeName(self);

  let title: string;
  let blurb: string;
  let from: Parameters<typeof traitColor>[0] = "openness";
  let to: Parameters<typeof traitColor>[0] = "conscientiousness";

  if (name.kind === "balanced") {
    title = t("type.balanced");
    blurb = t("type.balancedBlurb");
    from = "conscientiousness";
    to = "neuroticism";
  } else {
    const nounKey = `type.traits.${name.noun.trait}.${name.noun.pole}`;
    const gender = t(`${nounKey}.gender`);
    title = t("type.name", {
      article: t(`type.article_${gender}`),
      adjective: t(
        `type.traits.${name.lead.trait}.${name.lead.pole}.adjective_${gender}`
      ),
      noun: t(`${nounKey}.noun`),
    });
    blurb = name.defining
      .map((entry) => t(`result.bands.${entry.trait}.${entry.pole}`))
      .join(" ");
    from = name.lead.trait;
    to = name.noun.trait;
  }

  return (
    <section
      aria-labelledby="your-type"
      className="relative -mx-4 -mt-8 px-4 pb-8 pt-14 text-center"
    >
      {/* The wash belongs to the page: it sits behind everything and runs past
          the end of this section, so the first trait cards sit on it too. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-64 top-0 -z-10"
        style={{
          background: [
            `radial-gradient(ellipse 90% 40% at 50% 0%, ${traitColor(from, 0.34)}, transparent 100%)`,
            `radial-gradient(ellipse 80% 30% at 50% 62%, ${traitColor(to, 0.18)}, transparent 100%)`,
            `linear-gradient(180deg, ${traitColor(from, 0.2)} 0%, ${traitColor(to, 0.14)} 50%, transparent 100%)`,
          ].join(", "),
        }}
      />

      <div className="relative">
        {(takenOn || daysRead !== null) && (
          <ul className="mb-5 flex flex-wrap justify-center gap-2">
            {takenOn && (
              <li className="rounded-full border border-foreground/15 bg-background/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
                {t("result.takenOn", { date: takenOn })}
              </li>
            )}
            {daysRead !== null && (
              <li className="rounded-full border border-foreground/15 bg-background/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
                {t("result.journalPill", { count: daysRead })}
              </li>
            )}
          </ul>
        )}
        <p className="text-[0.75rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {t("type.eyebrow")}
        </p>
        <h2
          id="your-type"
          className="mx-auto mt-2 max-w-[18rem] font-display text-[2.25rem] italic leading-[1.1] tracking-[-0.02em] text-foreground"
        >
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-[22rem] font-display text-[1.0625rem] leading-relaxed text-foreground/80">
          {blurb}
        </p>

        {name.kind === "named" && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">
              {t("type.definedBy")}
            </p>
            <ul className="mt-1.5 flex flex-wrap justify-center gap-2">
              {name.defining.map((entry) => (
                <li
                  key={entry.trait}
                  className="flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1 text-[0.8125rem] backdrop-blur-sm"
                  style={{ borderColor: traitColor(entry.trait, 0.5) }}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ background: traitColor(entry.trait) }}
                  />
                  {t(`traits.${entry.trait}.${entry.pole}`)}
                  <span className="tabular-nums text-muted-foreground">
                    {self[entry.trait]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6">
          <RadarChart
            self={self}
            journal={journal}
            last={last}
            tint={[from, to]}
          />
        </div>

        <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${traitColor(from)}, ${traitColor(to)})`,
              }}
            />
            {t("result.you")}
          </li>
          {journal && (
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-0 w-4 border-t-2 border-dashed border-foreground"
              />
              {t("result.journal")}
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
      </div>
    </section>
  );
}
