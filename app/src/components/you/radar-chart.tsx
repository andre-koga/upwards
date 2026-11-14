import { useTranslation } from "react-i18next";
import { TRAITS, type Trait, type TraitScores } from "@/lib/personality/items";
import { traitColor } from "@/lib/personality/trait-colors";

const CX = 210;
const CY = 152;
const RADIUS = 118;
const RINGS = [25, 50, 75, 100] as const;

function angle(index: number): number {
  return ((-90 + index * (360 / TRAITS.length)) * Math.PI) / 180;
}

function point(index: number, value: number, extra = 0) {
  const r = (RADIUS * value) / 100 + extra;
  return {
    x: CX + r * Math.cos(angle(index)),
    y: CY + r * Math.sin(angle(index)),
  };
}

function polygon(scores: TraitScores): string {
  return TRAITS.map((trait, index) => {
    const { x, y } = point(index, scores[trait]);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

interface RadarChartProps {
  self: TraitScores;
  journal: TraitScores | null;
  last: TraitScores | null;
  /** Where the daily answers sit on each trait with enough of them, 0-100. */
  choices?: Partial<Record<Trait, number>> | null;
  /** The two traits that shape the type tint the shape. */
  tint: [Trait, Trait];
}

/**
 * The five traits as a pentagon. Drawn by hand in SVG: no chart library. The
 * picture is decorative; the wrapper carries every number as text.
 */
export function RadarChart({
  self,
  journal,
  last,
  choices = null,
  tint,
}: RadarChartProps) {
  const { t } = useTranslation("personality");

  const label = TRAITS.map(
    (trait) => `${t(`traits.${trait}.name`)} ${self[trait]}`
  ).join(", ");

  return (
    <div
      role="img"
      aria-label={`${t("result.you")}: ${label}.${
        journal
          ? ` ${t("result.journal")}: ${TRAITS.map(
              (trait) => `${t(`traits.${trait}.name`)} ${journal[trait]}`
            ).join(", ")}.`
          : ""
      }${
        choices
          ? ` ${t("result.choices")}: ${TRAITS.filter(
              (trait) => choices[trait] !== undefined
            )
              .map((trait) => `${t(`traits.${trait}.name`)} ${choices[trait]}`)
              .join(", ")}.`
          : ""
      }`}
    >
      <svg
        viewBox="-35 0 490 305"
        className="mx-auto block w-full max-w-[26rem] overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1">
            <stop
              offset="0%"
              stopColor={traitColor(tint[0])}
              stopOpacity="0.55"
            />
            <stop
              offset="100%"
              stopColor={traitColor(tint[1])}
              stopOpacity="0.4"
            />
          </linearGradient>
          <linearGradient id="radar-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={traitColor(tint[0])} />
            <stop offset="100%" stopColor={traitColor(tint[1])} />
          </linearGradient>
        </defs>

        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={TRAITS.map((_, index) => {
              const { x, y } = point(index, ring);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(" ")}
            fill="none"
            className="stroke-foreground/20"
            strokeWidth={ring === 100 ? 1.25 : 1}
            strokeDasharray={ring === 100 ? undefined : "2 4"}
          />
        ))}

        {TRAITS.map((trait, index) => {
          const end = point(index, 100);
          return (
            <line
              key={trait}
              x1={CX}
              y1={CY}
              x2={end.x}
              y2={end.y}
              stroke={traitColor(trait, 0.45)}
              strokeWidth={1.5}
            />
          );
        })}

        <g
          className="motion-safe:duration-700 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-50"
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        >
          {last && (
            <polygon
              points={polygon(last)}
              fill="none"
              className="stroke-muted-foreground/60"
              strokeWidth={1.25}
              strokeDasharray="1 4"
              strokeLinecap="round"
            />
          )}
          <polygon
            points={polygon(self)}
            fill="url(#radar-fill)"
            stroke="url(#radar-stroke)"
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {journal && (
            <polygon
              points={polygon(journal)}
              fill="none"
              className="stroke-foreground"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinejoin="round"
            />
          )}
          {TRAITS.map((trait, index) => {
            const { x, y } = point(index, self[trait]);
            return (
              <circle
                key={trait}
                cx={x}
                cy={y}
                r={5.5}
                fill={traitColor(trait)}
                className="stroke-background"
                strokeWidth={2}
              />
            );
          })}
          {TRAITS.map((trait, index) => {
            const value = choices?.[trait];
            if (value === undefined) return null;
            const { x, y } = point(index, value);
            return (
              <rect
                key={`choices-${trait}`}
                x={x - 4.5}
                y={y - 4.5}
                width={9}
                height={9}
                transform={`rotate(45 ${x} ${y})`}
                className="fill-background stroke-foreground"
                strokeWidth={2}
              />
            );
          })}
        </g>

        {TRAITS.map((trait, index) => {
          const { x, y } = point(index, 100, 16);
          const cos = Math.cos(angle(index));
          const sin = Math.sin(angle(index));
          const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
          const nameY = sin < -0.9 ? y - 14 : sin > 0.5 ? y + 10 : y - 3;
          return (
            <g key={trait}>
              <text
                x={x}
                y={nameY}
                textAnchor={anchor}
                className="fill-muted-foreground text-[12px]"
              >
                {t(`traits.${trait}.name`)}
              </text>
              <text
                x={x}
                y={nameY + 17}
                textAnchor={anchor}
                className="fill-foreground text-[16px] font-semibold"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {self[trait]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
