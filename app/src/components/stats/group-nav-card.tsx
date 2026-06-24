import { cn } from "@/lib/utils";

function MiniRateSparkline({ rates, color }: { rates: number[]; color: string }) {
  if (rates.length === 0) return null;

  return (
    <div className="flex h-4 w-full items-end gap-px" aria-hidden>
      {rates.map((rate, i) => {
        const height = rate <= 0 ? 2 : Math.max(2, Math.round((rate / 100) * 16));
        return (
          <div
            key={i}
            className="min-w-0 flex-1 rounded-[1px] bg-muted"
            style={{
              height,
              backgroundColor: rate > 0 ? color : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export function GroupNavCard({
  name,
  color,
  habitCount,
  completionRate30d,
  sparklineRates,
  onClick,
  className,
}: {
  name: string;
  color: string;
  habitCount: number;
  completionRate30d: number | null;
  sparklineRates: number[];
  onClick?: () => void;
  className?: string;
}) {
  const rateLabel =
    completionRate30d === null ? "—" : `${Math.round(completionRate30d)}%`;
  const habitLabel = habitCount === 1 ? "1 habit" : `${habitCount} habits`;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-lg text-left transition-colors",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">{name}</span>
        <p className="shrink-0 text-sm font-semibold tabular-nums leading-tight">{rateLabel}</p>
      </div>
      <div className="space-y-1">
        <MiniRateSparkline rates={sparklineRates} color={color} />
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>{habitLabel}</span>
          <span>30d</span>
        </div>
      </div>
    </button>
  );
}
