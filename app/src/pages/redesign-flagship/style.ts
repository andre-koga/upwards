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
