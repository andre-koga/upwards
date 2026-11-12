import { useTranslation } from "react-i18next";
import type { Trait } from "@/lib/personality/items";
import { cn } from "@/lib/utils";

interface TraitTrackProps {
  trait: Trait;
  self: number;
  /** Journal reading score, when a reading exists. */
  journal: number | null;
  /** The same trait on the previous finished sitting. */
  last: number | null;
}

function Mark({ score, className }: { score: number; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full",
        className
      )}
      style={{ left: `${score}%` }}
    />
  );
}

/**
 * One trait as a line from low to high. The marks are fixed to the scores and
 * cannot be dragged; the line carries a text equivalent with every number.
 */
export function TraitTrack({ trait, self, journal, last }: TraitTrackProps) {
  const { t } = useTranslation("personality");
  const name = t(`traits.${trait}.name`);

  const label = [
    journal === null
      ? t("result.trackAria", { trait: name, self })
      : t("result.trackAriaJournal", { trait: name, self, journal }),
    last === null ? null : t("result.trackAriaLast", { last }),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[1.0625rem] text-foreground">
          {name}
        </h3>
        <p
          aria-hidden="true"
          className="text-[0.8125rem] tabular-nums text-muted-foreground"
        >
          <span className="text-foreground">{self}</span>
          {journal !== null && (
            <>
              <span className="mx-1.5">/</span>
              <span className="text-terracotta-text">{journal}</span>
            </>
          )}
        </p>
      </div>

      <div role="img" aria-label={label} className="relative mx-2 mt-3 h-5">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[hsl(var(--line-strong)/0.45)]"
        />
        {last !== null && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 block h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-muted-foreground/60"
            style={{ left: `${last}%` }}
          />
        )}
        {journal !== null && (
          <Mark
            score={journal}
            className="size-3 border-2 border-terracotta bg-background"
          />
        )}
        <Mark score={self} className="size-3.5 bg-primary" />
      </div>

      <div
        aria-hidden="true"
        className="mt-1.5 flex justify-between text-xs text-muted-foreground"
      >
        <span>{t(`traits.${trait}.low`)}</span>
        <span>{t(`traits.${trait}.high`)}</span>
      </div>
    </div>
  );
}
