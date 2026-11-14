import { useTranslation } from "react-i18next";
import { TRAITS, type Trait, type TraitScores } from "@/lib/personality/items";
import { traitColor } from "@/lib/personality/trait-colors";
import {
  DRIFT_MIN_ANSWERS,
  driftFromTest,
  type Evidence,
  type TraitEvidence,
} from "@/lib/questions/evidence";

/** A lean from -1 to 1 as a position along the bar, 0 to 100. */
function position(lean: number): number {
  return Math.round(((lean + 1) / 2) * 100);
}

function ChoicesTrack({
  trait,
  evidence,
  testScore,
}: {
  trait: Trait;
  evidence: TraitEvidence;
  testScore: number;
}) {
  const { t } = useTranslation("you");
  const { t: tp } = useTranslation("personality");
  const name = tp(`traits.${trait}.name`);
  const enough = evidence.count >= DRIFT_MIN_ANSWERS;
  const drift = driftFromTest(evidence, testScore);

  const label = enough
    ? t("choices.trackAria", {
        trait: name,
        choices: position(evidence.lean),
        test: testScore,
      })
    : t("choices.answers", { count: evidence.count });

  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.9375rem] font-medium text-foreground">{name}</h3>
        <p className="text-xs tabular-nums text-muted-foreground">
          {t("choices.answers", { count: evidence.count })}
        </p>
      </div>

      <div role="img" aria-label={label} className="relative mx-2 h-6">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${traitColor(trait, 0.12)}, ${traitColor(trait, 0.6)})`,
          }}
        />
        {enough && (
          <>
            <span
              aria-hidden="true"
              className="absolute top-1/2 block h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/50"
              style={{ left: `${testScore}%` }}
            />
            <span
              aria-hidden="true"
              className="absolute top-1/2 block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow-md"
              style={{
                left: `${position(evidence.lean)}%`,
                background: traitColor(trait),
              }}
            />
          </>
        )}
      </div>

      <div
        aria-hidden="true"
        className="flex justify-between px-2 text-xs text-muted-foreground"
      >
        <span>{tp(`traits.${trait}.low`)}</span>
        <span>{tp(`traits.${trait}.high`)}</span>
      </div>

      {drift && (
        <p className="text-[0.9375rem] leading-relaxed text-foreground/80">
          {t(`choices.drift.${drift}`, {
            word: tp(`traits.${trait}.${drift === "higher" ? "high" : "low"}`),
          })}
        </p>
      )}
    </li>
  );
}

/**
 * Which way the daily answers lean, trait by trait, beside the test. It is
 * evidence, kept apart from the test scores: it never moves them.
 */
export function YourChoices({
  evidence,
  scores,
}: {
  evidence: Evidence;
  scores: TraitScores;
}) {
  const { t } = useTranslation("you");
  const answered = TRAITS.reduce(
    (sum, trait) => sum + evidence[trait].count,
    0
  );
  if (answered === 0) return null;

  return (
    <section
      aria-labelledby="your-choices"
      className="border-t border-border pt-6"
    >
      <h2
        id="your-choices"
        className="font-display text-[1.375rem] italic leading-snug text-foreground/85"
      >
        {t("choices.heading")}
      </h2>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
        {t("choices.intro")}
      </p>
      <ul className="mt-5 space-y-6">
        {TRAITS.map((trait) => (
          <ChoicesTrack
            key={trait}
            trait={trait}
            evidence={evidence[trait]}
            testScore={scores[trait]}
          />
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted-foreground">{t("choices.note")}</p>
    </section>
  );
}
