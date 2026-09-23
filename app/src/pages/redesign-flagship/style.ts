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

export type TabId = "Home" | "Today" | "Journal" | "You";

// Glass recipe, per docs/architecture/design-and-branding.md §2.5: frosted
// surface + hairline top highlight, reserved for floating/sticky chrome and AI
// surfaces. Content cards stay opaque paper.
export const glass =
  "bg-[var(--paper)]/70 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(92,77,58,0.12)]";

// Low-opacity grain so glass and the AI gradient don't read as flat digital
// fills. Never applied to text.
export const grainUrl =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")";

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
