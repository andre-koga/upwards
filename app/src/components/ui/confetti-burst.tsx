import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ConfettiBurstProps {
  /** When true, spawn a new burst. Re-triggers a fresh burst whenever it transitions false → true. */
  active: boolean;
  particleCount?: number;
  /** Longest particle lifetime in ms; after this the overlay unmounts. */
  durationMs?: number;
  colors?: readonly string[];
}

interface Particle {
  id: number;
  leftPercent: number;
  size: number;
  color: string;
  shape: "rect" | "circle";
  delayMs: number;
  durationMs: number;
  driftPx: number;
  rotateStartDeg: number;
  rotateEndDeg: number;
  spinDurationMs: number;
}

const DEFAULT_COLORS = [
  "#16a34a", // green-600
  "#22c55e", // green-500
  "#eab308", // yellow-500
  "#f59e0b", // amber-500
  "#3b82f6", // blue-500
  "#ec4899", // pink-500
  "#a855f7", // purple-500
] as const;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateParticles(
  count: number,
  baseDurationMs: number,
  colors: readonly string[]
): Particle[] {
  const palette = colors.length > 0 ? colors : DEFAULT_COLORS;
  return Array.from({ length: count }, (_, i) => {
    const fallDuration = randomBetween(
      baseDurationMs * 0.6,
      baseDurationMs * 1.0
    );
    return {
      id: i,
      leftPercent: randomBetween(0, 100),
      size: randomBetween(6, 12),
      color: palette[Math.floor(Math.random() * palette.length)]!,
      shape: Math.random() < 0.35 ? "circle" : "rect",
      delayMs: randomBetween(0, baseDurationMs * 0.25),
      durationMs: fallDuration,
      driftPx: randomBetween(-80, 80),
      rotateStartDeg: randomBetween(0, 360),
      rotateEndDeg: randomBetween(180, 720) * (Math.random() < 0.5 ? -1 : 1),
      spinDurationMs: randomBetween(400, 1400),
    };
  });
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ConfettiBurst({
  active,
  particleCount = 120,
  durationMs = 3200,
  colors = DEFAULT_COLORS,
}: ConfettiBurstProps) {
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const burstIdRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) return;

    burstIdRef.current += 1;
    const myBurst = burstIdRef.current;

    setParticles(generateParticles(particleCount, durationMs, colors));
    setVisible(true);

    const totalLifespan = durationMs + 800;
    const timer = window.setTimeout(() => {
      if (burstIdRef.current === myBurst) {
        setVisible(false);
        setParticles([]);
      }
    }, totalLifespan);

    return () => window.clearTimeout(timer);
  }, [active, particleCount, durationMs, colors]);

  const styleTag = useMemo(
    () => (
      <style>{`
        @keyframes okhabit-confetti-fall {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(var(--okhabit-confetti-drift, 0px), 130vh, 0);
          }
        }
        @keyframes okhabit-confetti-spin {
          from { transform: rotate(var(--okhabit-confetti-rot-start, 0deg)); }
          to { transform: rotate(var(--okhabit-confetti-rot-end, 360deg)); }
        }
      `}</style>
    ),
    []
  );

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {styleTag}
      {particles.map((p) => {
        const isCircle = p.shape === "circle";
        return (
          <span
            key={p.id}
            style={{
              position: "absolute",
              top: "-15vh",
              left: `${p.leftPercent}%`,
              width: p.size,
              height: isCircle ? p.size : p.size * 1.6,
              ["--okhabit-confetti-drift" as never]: `${p.driftPx}px`,
              animation: `okhabit-confetti-fall ${p.durationMs}ms linear ${p.delayMs}ms forwards`,
              willChange: "transform",
            }}
          >
            <span
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                backgroundColor: p.color,
                borderRadius: isCircle ? "50%" : 2,
                ["--okhabit-confetti-rot-start" as never]: `${p.rotateStartDeg}deg`,
                ["--okhabit-confetti-rot-end" as never]: `${p.rotateEndDeg}deg`,
                animation: `okhabit-confetti-spin ${p.spinDurationMs}ms linear infinite`,
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}
            />
          </span>
        );
      })}
    </div>,
    document.body
  );
}
