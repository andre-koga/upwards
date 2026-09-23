// Shared mock data for the /redesign-preview* visual-language studies.
// Kept in one place so the alternate variants (b/c/d) don't re-type the
// same fixtures as app/src/pages/redesign-preview.tsx. None of this is wired
// to real Dexie/Supabase data — it's static content for design exploration.

export const tasks = [
  {
    title: "Morning pages",
    meta: "Personal · 20 min",
    state: "complete" as const,
    color: "#789b7f",
  },
  {
    title: "Deep work block",
    meta: "Studio refresh · 9:30–11:30",
    state: "current" as const,
    color: "#c36e52",
  },
  {
    title: "Walk without a phone",
    meta: "Wellbeing · 30 min",
    state: "upcoming" as const,
    color: "#d5a94a",
  },
  {
    title: "Call Mum",
    meta: "Personal · Before 18:00",
    state: "upcoming" as const,
    color: "#8d84a9",
  },
];

export const rhythmBars = [
  { day: "M", value: 82, active: false },
  { day: "T", value: 64, active: false },
  { day: "W", value: 91, active: true },
  { day: "T", value: 52, active: false },
  { day: "F", value: 74, active: false },
  { day: "S", value: 38, active: false },
  { day: "S", value: 57, active: false },
];

export const spaces = [
  { label: "Studio refresh", count: "4 open", color: "#c36e52" },
  { label: "Personal", count: "2 open", color: "#789b7f" },
  { label: "Wellbeing", count: "1 open", color: "#d5a94a" },
];

export const insightSummary =
  "You're most consistent before noon — mornings run at 91% completion versus 58% after 3pm.";

export const insightRecommendations = [
  {
    title: "Move deep work earlier",
    detail:
      "Deep work block finishes on time 90% of days when started before 10am, only 40% after — try shifting it 30 minutes earlier.",
    color: "#c36e52",
  },
  {
    title: "Protect the Wednesday streak",
    detail:
      "Your rhythm peaks midweek. Wednesdays have your highest completion rate this month — keep the load light on Thursdays to avoid burnout.",
    color: "#426a5a",
  },
  {
    title: "Wellbeing is slipping",
    detail:
      "Walk without a phone has been skipped 3 of the last 5 days. Pairing it right after lunch has worked well in the past.",
    color: "#d5a94a",
  },
];

export const journalEntries = [
  {
    date: "Sep 22, 2026",
    snippet: "Closed the laptop by seven and actually meant it this time.",
    emoji: "🌙",
    bookmarked: true,
  },
  {
    date: "Sep 21, 2026",
    snippet: "Long walk turned into a long call with an old friend.",
    emoji: "☎️",
    bookmarked: false,
  },
  {
    date: "Sep 20, 2026",
    snippet: "Rain all day. Read on the couch instead of forcing a run.",
    emoji: "🌧️",
    bookmarked: false,
  },
  {
    date: "Sep 19, 2026",
    snippet: "Studio refresh finally has a color plan. Feels real now.",
    emoji: "🎨",
    bookmarked: true,
  },
];

export const memories = [
  {
    timeLabel: "Around 2019",
    snippet: "The apartment with the bad radiator and the good light.",
    color: "#e1ebe1",
  },
  {
    timeLabel: "When I was six",
    snippet: "Dad taught me to ride a bike in the church parking lot.",
    color: "#f3dfd7",
  },
  {
    timeLabel: "Summer, a few years back",
    snippet: "Three weeks with no plans. Still the best vacation.",
    color: "#f6ecd3",
  },
  {
    timeLabel: "Right after graduating",
    snippet: "Drove across the state with everything I owned in the back seat.",
    color: "#e6e1ee",
  },
];

export type TabId = "Home" | "Today" | "Journal" | "Memories";

export const tabOrder: TabId[] = ["Home", "Today", "Journal", "Memories"];
