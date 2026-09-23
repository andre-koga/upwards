import type { CSSProperties } from "react";

// Non-component constants for the flagship mockup, split out of shared.tsx
// so that file can stay component-only (react-refresh/only-export-components).

export const flagshipStyle = {
  "--ink": "#21332c",
  "--muted": "#6e776f",
  "--faint": "#9aa199",
  "--paper": "#fffdf8",
  "--canvas": "#f4efe6",
  "--canvas-deep": "#eee6d7",
  "--line": "#e4dccf",
  "--sage": "#e1ebe1",
  "--green": "#3f6656",
  "--green-deep": "#28453a",
  "--terracotta": "#c36e52",
  "--gold": "#c99a3f",
  "--lavender": "#8d84a9",
} as CSSProperties;

export type TabId = "Home" | "Today" | "Journal" | "Memories" | "You";

// The one consistent "this is the AI" color signature used everywhere an
// AI-driven feature shows up — the big Home hero, the compass check-in
// card, the journal-prompt card, the memories throwback, the "ordered by
// what works for you" badge on Today. Everything else in the app stays
// warm-neutral paper; this gradient is the single splash of life and
// color, reused rather than reinvented per surface so it reads as one
// consistent "the AI touched this" signal.
export const aiGradient =
  "radial-gradient(120% 140% at 0% 0%, #3f6656 0%, #2c5246 32%, #1f3f52 58%, #4a3b63 78%, #a4643f 100%)";

export const aiGradientLinear =
  "linear-gradient(90deg, #3f6656, #1f3f52, #8d84a9, #c99a3f)";
