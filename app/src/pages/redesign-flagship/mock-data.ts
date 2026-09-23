// Mock fixtures for the flagship mockup covering features the earlier passes
// omitted. Audited against the real app so the redesign doesn't silently drop
// shipped functionality (see docs/architecture/design-and-branding.md §3.4).
// Static design data only — nothing here touches Dexie or Supabase.

// --- Today: activity kinds the real app supports ---------------------------

export type ActivityKind = "checkbox" | "counter" | "never" | "anytime";

export const todayActivities: {
  title: string;
  group: string;
  color: string;
  kind: ActivityKind;
  count?: number;
  target?: number;
  streak: number;
  done?: boolean;
  slips?: number;
  trackedMs?: number;
  running?: boolean;
  pinned?: boolean;
  aiReason?: string;
}[] = [
  {
    title: "Morning pages",
    group: "Personal",
    color: "#789b7f",
    kind: "checkbox",
    done: true,
    streak: 12,
    trackedMs: 1_200_000,
    aiReason: "You finish this 95% of days when it's first",
  },
  {
    title: "Deep work block",
    group: "Studio refresh",
    color: "#c36e52",
    kind: "checkbox",
    streak: 4,
    running: true,
    trackedMs: 3_930_000,
    aiReason: "Starts on time 3x more often after two quick wins",
  },
  {
    title: "Glasses of water",
    group: "Wellbeing",
    color: "#d5a94a",
    kind: "counter",
    count: 5,
    target: 8,
    streak: 9,
  },
  {
    title: "No phone after 22:00",
    group: "Wellbeing",
    color: "#8d84a9",
    kind: "never",
    slips: 0,
    streak: 6,
  },
  {
    title: "Call Mum",
    group: "Personal",
    color: "#789b7f",
    kind: "checkbox",
    streak: 2,
    pinned: true,
  },
];

export const anytimeActivities = [
  { title: "Reading", group: "Personal", color: "#789b7f", allTimeMs: 47_400_000 },
  { title: "Guitar", group: "Personal", color: "#8d84a9", allTimeMs: 12_600_000 },
];

// --- Today: memos (one-time tasks) ----------------------------------------

export const memos = [
  { title: "Book the dentist", due: "Today", pinned: true, done: false },
  { title: "Reply to Sam about the quote", due: "Tomorrow", pinned: false, done: false },
  { title: "Order the tile samples", due: null, pinned: false, done: true, recurring: false },
  { title: "Water the plants", due: "Today", pinned: false, done: false, recurring: true },
];

// --- Today: the sessions timeline ----------------------------------------

export const timelineSessions = [
  {
    activity: "Deep work block",
    group: "Studio refresh",
    color: "#c36e52",
    kind: "running" as const,
    label: "1:05:30",
    note: null,
  },
  {
    activity: "Morning pages",
    group: "Personal",
    color: "#789b7f",
    kind: "timed" as const,
    label: "20:00",
    note: "Slow start, but the page filled up.",
  },
  {
    activity: "Glasses of water",
    group: "Wellbeing",
    color: "#d5a94a",
    kind: "untimed" as const,
    label: "09:12",
    note: null,
  },
];

export const timelineTotal = "1:25:30";

// --- Journal: the merged record (exact + approximate dates) ---------------

export type DatePrecision = "exact" | "approximate";

export const recordEntries: {
  id: string;
  precision: DatePrecision;
  dateLabel: string;
  dayNum?: string;
  weekday?: string;
  emoji: string;
  title: string;
  snippet: string;
  bookmarked: boolean;
  photos: number;
  hasVideo: boolean;
  places: string[];
  entryNumber?: number;
}[] = [
  {
    id: "2026-09-23",
    precision: "exact",
    dateLabel: "Sep 23, 2026",
    dayNum: "23",
    weekday: "Wed",
    emoji: "🌤️",
    title: "A slower start",
    snippet:
      "I let the morning arrive before I started asking it to be useful. Coffee, open windows, and one clear page.",
    bookmarked: true,
    photos: 3,
    hasVideo: true,
    places: ["Living room", "Rua Augusta"],
    entryNumber: 184,
  },
  {
    id: "2026-09-22",
    precision: "exact",
    dateLabel: "Sep 22, 2026",
    dayNum: "22",
    weekday: "Tue",
    emoji: "🌙",
    title: "Closed the laptop",
    snippet: "Closed the laptop by seven and actually meant it this time.",
    bookmarked: false,
    photos: 0,
    hasVideo: false,
    places: [],
    entryNumber: 183,
  },
  {
    id: "2026-09-21",
    precision: "exact",
    dateLabel: "Sep 21, 2026",
    dayNum: "21",
    weekday: "Mon",
    emoji: "☎️",
    title: "Long walk, long call",
    snippet: "Long walk turned into a long call with an old friend.",
    bookmarked: false,
    photos: 2,
    hasVideo: false,
    places: ["Parque Ibirapuera"],
    entryNumber: 182,
  },
  {
    id: "mem-studio",
    precision: "approximate",
    dateLabel: "3 years ago",
    emoji: "🔑",
    title: "Signed the studio lease",
    snippet: "Terrified and thrilled in equal parts.",
    bookmarked: true,
    photos: 1,
    hasVideo: false,
    places: [],
  },
  {
    id: "mem-six",
    precision: "approximate",
    dateLabel: "When I was six",
    emoji: "🚲",
    title: "Learning to ride",
    snippet: "Dad taught me to ride a bike in the church parking lot.",
    bookmarked: false,
    photos: 0,
    hasVideo: false,
    places: [],
  },
];

export const recordFilters = ["Hearted", "Photos", "Video", "Places"];

export const recordViewModes = ["Feed", "Calendar", "Map", "Gallery"] as const;
export type RecordViewMode = (typeof recordViewModes)[number];

// Month grid for the Calendar view mode: density marker per day.
export const calendarDays = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const written = [1, 2, 4, 5, 8, 9, 10, 12, 15, 16, 17, 19, 21, 22, 23].includes(
    day
  );
  return {
    day,
    written,
    bookmarked: [5, 17, 23].includes(day),
    future: day > 23,
  };
});

export const galleryMonths = [
  {
    month: "September 2026",
    items: [
      { id: "g1", kind: "video" as const, tone: "#cdd9cd" },
      { id: "g2", kind: "photo" as const, tone: "#d9cfc0" },
      { id: "g3", kind: "photo" as const, tone: "#c9d2cb" },
      { id: "g4", kind: "photo" as const, tone: "#dcd2c4" },
      { id: "g5", kind: "photo" as const, tone: "#d2d8cf" },
      { id: "g6", kind: "photo" as const, tone: "#d7ccc2" },
    ],
  },
  {
    month: "August 2026",
    items: [
      { id: "g7", kind: "photo" as const, tone: "#d0d7cf" },
      { id: "g8", kind: "photo" as const, tone: "#dbd1c3" },
      { id: "g9", kind: "video" as const, tone: "#ccd4cc" },
    ],
  },
];

export const mapPins = [
  { label: "São Paulo", count: 42, x: 32, y: 66 },
  { label: "Lisbon", count: 8, x: 47, y: 38 },
  { label: "Tokyo", count: 3, x: 82, y: 40 },
  { label: "New York", count: 6, x: 25, y: 36 },
];

// --- Command palette (cross-entity search) -------------------------------

export const paletteGroups = [
  {
    label: "Entries",
    items: [
      { icon: "entry", title: "A slower start", meta: "Sep 23, 2026" },
      { icon: "entry", title: "Signed the studio lease", meta: "3 years ago" },
    ],
  },
  {
    label: "Activities",
    items: [
      { icon: "activity", title: "Deep work block", meta: "Studio refresh · running" },
      { icon: "activity", title: "Morning pages", meta: "Personal · 12 day streak" },
    ],
  },
  {
    label: "Places",
    items: [{ icon: "place", title: "Parque Ibirapuera", meta: "14 days" }],
  },
  {
    label: "Settings",
    items: [
      { icon: "setting", title: "Appearance", meta: "Theme · 9 palettes" },
      { icon: "setting", title: "AI insights", meta: "Base URL · model · key" },
    ],
  },
];
