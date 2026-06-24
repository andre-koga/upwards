import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

export function useFloatingTooltip() {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRefs = useRef<number[]>([]);

  const clearTimers = () => {
    timerRefs.current.forEach(window.clearTimeout);
    timerRefs.current = [];
  };

  const show = useCallback((x: number, y: number, text: string) => {
    clearTimers();
    setTooltip({ x, y, text });
    setVisible(false);
    timerRefs.current.push(window.setTimeout(() => setVisible(true), 10));
    timerRefs.current.push(window.setTimeout(() => setVisible(false), 1500));
    timerRefs.current.push(window.setTimeout(() => setTooltip(null), 1700));
  }, []);

  useEffect(() => () => clearTimers(), []);

  return { tooltip, visible, show };
}

export function FloatingTooltip({
  tooltip,
  visible,
}: {
  tooltip: { x: number; y: number; text: string };
  visible: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-50 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs font-medium text-background transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: "translate(-50%, calc(-100% - 6px))",
      }}
    >
      {tooltip.text}
    </div>
  );
}
