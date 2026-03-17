/**
 * SRP: Displays the currently running memo with elapsed time and stop action.
 */
import { useEffect, useState, memo, useMemo } from "react";
import { db } from "@/lib/db";
import type { OneTimeTask } from "@/lib/db/types";
import { Square } from "lucide-react";
import { formatTimerDisplay } from "@/lib/activity-utils";
import { getContrastColor } from "@/lib/color-utils";

const MEMO_PILL_COLOR = "#6b7280";

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const safeHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const r = parseInt(safeHex.slice(0, 2), 16);
  const g = parseInt(safeHex.slice(2, 4), 16);
  const b = parseInt(safeHex.slice(4, 6), 16);

  if ([r, g, b].some(Number.isNaN)) {
    return `rgba(107, 114, 128, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface ActiveMemoPillProps {
  currentMemoId: string | null;
  oneTimeTasks: OneTimeTask[];
  elapsedMs: number;
  onStop: () => void;
}

function ActiveMemoPill({
  currentMemoId,
  oneTimeTasks,
  elapsedMs,
  onStop,
}: ActiveMemoPillProps) {
  const [resolvedMemo, setResolvedMemo] = useState<OneTimeTask | null>(null);

  useEffect(() => {
    if (!currentMemoId) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- clearing when memo stops */
      setResolvedMemo(null);
      return;
    }

    const fromProps = oneTimeTasks.find((t) => t.id === currentMemoId);
    if (fromProps) {
      setResolvedMemo(fromProps);
      return;
    }

    let cancelled = false;

    const loadFromDb = async () => {
      try {
        const memo = await db.oneTimeTasks.get(currentMemoId);
        if (!memo || cancelled) return;
        setResolvedMemo(memo);
      } catch (error) {
        console.error("Error loading active memo:", error);
      }
    };

    loadFromDb();

    return () => {
      cancelled = true;
    };
  }, [currentMemoId, oneTimeTasks]);

  const color = MEMO_PILL_COLOR;
  const textColor = useMemo(() => getContrastColor(color), [color]);
  const boxShadow = useMemo(
    () =>
      `0 0 16px ${hexToRgba(color, 0.4)}, 0 0 34px ${hexToRgba(color, 0.28)}`,
    [color]
  );

  if (!currentMemoId) {
    return null;
  }

  if (!resolvedMemo) {
    return null;
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 shadow-sm"
      style={{
        backgroundColor: color,
        color: textColor,
        boxShadow,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-0.5 truncate text-xs uppercase tracking-wide opacity-80">
            Memo
          </p>
          <p className="truncate text-lg font-semibold leading-tight">
            {resolvedMemo.title}
          </p>
        </div>
        <span
          className="shrink-0 text-sm"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {formatTimerDisplay(elapsedMs)}
        </span>
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onStop}
          className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide"
          style={{ color: textColor }}
          title="Stop this memo"
        >
          <Square className="h-3.5 w-3.5" style={{ fill: textColor }} />
          <span>Stop</span>
        </button>
      </div>
    </div>
  );
}

export default memo(ActiveMemoPill);
