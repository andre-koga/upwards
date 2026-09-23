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
    aiReason: "You finish this 95% of days when it's first",
  },
  {
    title: "Deep work block",
    meta: "Studio refresh · 9:30–11:30",
    state: "current" as const,
    color: "#c36e52",
    aiReason: "Starts on time 3x more often after two quick wins",
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
    pinned: true,
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
    goal: "Finish the studio refresh",
  },
  {
    title: "Protect the Wednesday streak",
    detail:
      "Your rhythm peaks midweek. Wednesdays have your highest completion rate this month — keep the load light on Thursdays to avoid burnout.",
    color: "#426a5a",
    goal: "Become someone who finishes what they start",
  },
  {
    title: "Wellbeing is slipping",
    detail:
      "Walk without a phone has been skipped 3 of the last 5 days. Pairing it right after lunch has worked well in the past.",
    color: "#d5a94a",
    goal: "Be a calmer, more present parent",
  },
];

// "Who I'm becoming" — the identity/goals layer the flagship mockup adds.
// This is what the AI insight is meant to point toward, rather than just
// reporting stats: the same weekly data, read against what the person says
// they're trying to become.
export const identityTraits = ["Present", "Disciplined", "Creative", "Patient"];

export const northStar =
  "Someone who finishes what they start, and rests without guilt.";

export const goals = [
  {
    title: "Be a calmer, more present parent",
    detail: "Ongoing · tied to Wellbeing",
    progress: 62,
    color: "#d5a94a",
    aiNote: "Surfaced in 3 insights this week",
  },
  {
    title: "Finish the studio refresh",
    detail: "Target: November · tied to Studio refresh",
    progress: 40,
    color: "#c36e52",
    aiNote: "On pace if this week's deep work holds",
  },
  {
    title: "Become someone who finishes what they start",
    detail: "Ongoing · tied to Personal",
    progress: 55,
    color: "#426a5a",
    aiNote: "Your longest-running thread — 4 months tracked",
  },
];

// The compass check-in cadence: every N days the AI asks a short round of
// questions and folds the answers into the knowledge map below, instead of
// the user filling out a profile once and it going stale.
export const nextCheckIn = {
  daysUntil: 2,
  questionCount: 3,
  estMinutes: 2,
};

// What the AI has learned from onboarding + check-ins so far, oldest first.
// This is the "organic, evolving" part — each entry is a real answer, dated,
// not a static bio field.
export const knowledgeMap = [
  {
    question: "What does a good day look like for you?",
    answer:
      "Coffee, a quiet morning, and one meaningful thing done before noon.",
    learnedAgo: "5 weeks ago",
  },
  {
    question: "What's a habit you're trying to build right now?",
    answer: "Getting outside without my phone, at least once a day.",
    learnedAgo: "3 weeks ago",
  },
  {
    question: "When do you feel most like yourself?",
    answer: "Right after a walk, before anyone needs anything from me.",
    learnedAgo: "2 days ago",
  },
];

// Strategies the AI has actually verified against this person's data —
// distinct from goals (what they want) and identity (who they are): this is
// what demonstrably works for them specifically.
export const strategies = [
  {
    title: "Morning deep work sticks, evening doesn't",
    detail:
      "6 weeks of data: 90% completion before 10am versus 40% after 6pm.",
    color: "#c36e52",
  },
  {
    title: "Short walks unlock better journal entries",
    detail: "Entries written within an hour of a walk run twice as long.",
    color: "#426a5a",
  },
  {
    title: "Two quick wins before the big one",
    detail:
      "Deep work starts on time 3x more often when 2+ small tasks are already checked off first.",
    color: "#c99a3f",
  },
];export const journalEntries = [
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

// AI-written journal prompts — shown when the entry is empty, tuned using
// what the AI already knows from the compass + recent days, not generic
// writing-prompt filler.
export const journalPrompts = [
  "You mentioned wanting to be calmer with your kids — what almost tested that today?",
  "Deep work started late again. What actually got in the way this morning?",
  "What's one thing from this week you'd want to remember in a year?",
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

// AI-curated "on this day" throwback — resurfaced automatically, not
// something the user has to go dig for.
export const memoryThrowback = {
  yearsAgo: 3,
  date: "Sep 23, 2023",
  snippet:
    "Signed the lease on the studio. Terrified and thrilled in equal parts.",
  color: "#f3dfd7",
};

export type TabId = "Home" | "Today" | "Journal" | "Memories";

export const tabOrder: TabId[] = ["Home", "Today", "Journal", "Memories"];
