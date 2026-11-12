import type { CSSProperties } from "react";

/**
 * A hearted day gets a soft diagonal wash of color behind it. Each wash blends
 * three palette tokens (never raw hexes), so it follows light and dark, and the
 * set is picked from the date so a day always keeps its own colors. The hues
 * are kept apart on purpose: neighbours in the same family read as mud.
 */
const WASHES: ReadonlyArray<readonly [string, string, string]> = [
  ["--lavender", "--terracotta", "--gold"],
  ["--green", "--lavender", "--terracotta"],
  ["--terracotta", "--lavender", "--green"],
  ["--gold", "--green", "--lavender"],
  ["--lavender", "--green", "--gold"],
  ["--terracotta", "--green", "--lavender"],
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const tone = (token: string, alpha: number) =>
  `hsl(var(${token}) / ${alpha})`;

/** Inline style for a hearted day's background. Stable for a given seed. */
export function heartedWashStyle(seed: string): CSSProperties {
  const [a, b, c] = WASHES[hash(seed) % WASHES.length];
  return {
    backgroundImage: `linear-gradient(135deg, ${tone(a, 0.34)} 0%, ${tone(b, 0.2)} 55%, ${tone(c, 0.3)} 100%)`,
  };
}
