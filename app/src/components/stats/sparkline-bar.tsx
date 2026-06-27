export function SparklineBar({
  height,
  color,
  isBreakDay,
  hasValue,
}: {
  height: number;
  color: string;
  isBreakDay?: boolean;
  hasValue: boolean;
}) {
  if (isBreakDay) {
    return (
      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[1px]"
        style={{ height }}
      >
        <div
          className="min-h-0 flex-1 bg-muted"
          style={hasValue ? { backgroundColor: color } : undefined}
        />
        <div className="h-[2px] shrink-0 bg-amber-500" aria-hidden />
      </div>
    );
  }

  return (
    <div
      className="min-w-0 flex-1 rounded-[1px] bg-muted"
      style={{
        height,
        backgroundColor: hasValue ? color : undefined,
      }}
    />
  );
}
