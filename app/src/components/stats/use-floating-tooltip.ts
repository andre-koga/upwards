import { useEffect, useRef, useState, useCallback } from "react";

export function useFloatingTooltip() {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
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
