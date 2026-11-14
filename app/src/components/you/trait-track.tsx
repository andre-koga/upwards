import { useTranslation } from "react-i18next";
import type { Trait } from "@/lib/personality/items";
import { traitColor } from "@/lib/personality/trait-colors";

interface TraitTrackProps {
  trait: Trait;
  self: number;
  /** Journal reading score, when a reading exists. */
  journal: number | null;
  /** The same trait on the previous finished sitting. */
  last: number | null;
  /** Where the daily answers sit on this bar, 0-100, once there are some. */
  choices?: number | null;
}

/**
 * One trait as a coloured bar from low to high. The marks are fixed to the
 * scores and cannot be dragged; the bar carries a text equivalent with every
 * number.
 */
export function TraitTrack({
  trait,
  self,
  journal,
  last,
  choices = null,
}: TraitTrackProps) {
  const { t } = useTranslation("personality");
  const name = t(`traits.${trait}.name`);

  const label = [
    journal === null
      ? t("result.trackAria", { trait: name, self })
      : t("result.trackAriaJournal", { trait: name, self, journal }),
    last === null ? null : t("result.trackAriaLast", { last }),
    choices === null ? null : t("result.trackAriaChoices", { choices }),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <div role="img" aria-label={label} className="relative mx-2 h-6">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${traitColor(trait, 0.12)}, ${traitColor(trait, 0.6)})`,
          }}
        />
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full"
          style={{
            width: `${self}%`,
            background: `linear-gradient(90deg, ${traitColor(trait, 0.5)}, ${traitColor(trait)})`,
          }}
        />
        {last !== null && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 block h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/50"
            style={{ left: `${last}%` }}
          />
        )}
        {journal !== null && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 block size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-foreground bg-background"
            style={{ left: `${journal}%` }}
          />
        )}
        {choices !== null && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 block size-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-foreground bg-background"
            style={{ left: `${choices}%` }}
          />
        )}
        <span
          aria-hidden="true"
          className="absolute top-1/2 block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-md"
          style={{ left: `${self}%`, background: traitColor(trait) }}
        />
      </div>

      <div
        aria-hidden="true"
        className="mt-1.5 flex justify-between px-2 text-xs text-muted-foreground"
      >
        <span>{t(`traits.${trait}.low`)}</span>
        <span>{t(`traits.${trait}.high`)}</span>
      </div>
    </div>
  );
}
