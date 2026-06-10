export interface FeatureRelease {
  /** ISO date (YYYY-MM-DD) for sorting and display */
  date: string;
  title: string;
  bullets: string[];
  /** Shown below features in smaller type */
  fixes?: string[];
}

/** Newest first. Edit this list when you ship user-visible changes. */
export const FEATURE_RELEASES: FeatureRelease[] = [
  {
    date: "2026-06-10",
    title: "Activity stats and a smarter day boundary",
    bullets: [
      "Tap any habit to see its stats: streaks, total time, a 90-day heatmap, and a by-day-of-week chart.",
      "Stats adapt to the habit type — timers show session lengths, check-off habits show success rate, 'never' habits show clean days.",
      "Filter stats by 7 days, 30 days, 90 days, 1 year, or all time.",
      "Settings for a habit or group moved to a cog icon — tapping the pill itself now opens stats.",
    ],
    fixes: [
      "Habits created after midnight (but before your day reset time) now appear correctly in For Today.",
      "Streak counts no longer reset to 0 when you complete a habit after midnight but before your day reset.",
      "The date picker on manual time entries no longer allows selecting tomorrow when the clock has passed midnight but not yet reached your reset time.",
      "The main calendar (day navigation) and all other date pickers now highlight the correct logical today based on your reset time.",
      "Swiping to the next day is blocked at the correct logical today, not the wall-clock date.",
      "The 'Today' button in the footer correctly identifies the current logical day.",
      "Due-date labels on one-off tasks ('Today', 'Yesterday') now match your reset time.",
      "Marking a habit complete from the Projects drawer now stamps it on the correct logical day.",
    ],
  },
  {
    date: "2026-06-05",
    title: "Archive memos and error logs",
    bullets: [
      "Archive memos you want to hide without deleting them — click the archive icon next to the Memos title to view and restore archived memos.",
      "Restore or permanently delete archived memos from a compact dialog.",
      "Error logs page shows all errors and important events from the last 24 hours, automatically cleaned up daily.",
      "Access Error Logs from the More menu to share logs with support when troubleshooting.",
      "Day reset time now uses 1-hour increments from midnight to 8 AM for simpler configuration.",
      "Memo text now properly displays line breaks, matching what you see in the edit dialog.",
    ],
    fixes: [
      "Archived memos now persist correctly after sync.",
      "Day reset dropdown styling now matches the appearance section for consistency.",
    ],
  },
  {
    date: "2026-06-04",
    title: "Overnight sessions & smarter timeline",
    bullets: [
      "Track sessions that run past midnight — they show up on both days automatically.",
      "Add or edit a session with an end time before the start time; a warning tells you it spans two days and saves correctly.",
      "Edit sessions and check off habits up to 7 days back (up from today-only).",
      "The timeline header now shows your day's reset time so you always know which hours count.",
      "The footer date button shows the day of the week.",
      "Manual time entries now default to a 5-minute window.",
    ],
    fixes: [
      "Habit timers now show only the time tracked today, not the full session.",
      "Sharing a day recap works again.",
    ],
  },
  {
    date: "2026-06-02",
    title: "Daily recap and friend sharing",
    bullets: [
      "When you open the app after a new day, a recap dialog shows yesterday's completed and missed habits.",
      "Share your day recap with friends, optionally adding a message.",
      "Friends receive a single notification that opens a summary of your day.",
      "Add friends by username; the bell inbox handles friend requests and shared day recaps.",
    ],
    fixes: [
      "Projects drawer timers show all-time tracked time per habit again.",
      "Mark habits as done from the Projects drawer; they stay on For Today through the day you finish them.",
    ],
  },
  {
    date: "2026-05-15",
    title: "New nav, pinned memos, and simpler group editing",
    bullets: [
      "Notifications button is now a fixed bell in the top-right corner (only on the home screen).",
      "Pinned memos show a pin icon inside the checkbox, matching the visual logic of the For Today section.",
      "Clicking a group or activity name in the Projects drawer opens the edit dialog directly — no separate page needed.",
      "Stats moved to a cleaner /stats page; legacy /activities routes removed.",
    ],
    fixes: [
      "Previous/next day navigation dialog is now centered.",
      "What's New page always opens at the top (newest update first).",
    ],
  },
  {
    date: "2026-05-14",
    title: "Simpler groups, clearer sessions, and quicker time edits",
    bullets: [
      "Activity groups and tasks no longer use emoji—names and colors carry the group identity.",
      "The clock-style time picker has -5 min and +5 min shortcuts under the hour, minute, second, and AM/PM controls.",
      "Archived groups and activities are now easier to manage in the Archive view.",
      "Recompute streak counters in case of bugs by pressing the refresh icon in the Today view, to the right of the For Today heading.",
    ],
    fixes: [
      "Session details is streamlined: pick the activity and adjust start and end time only (group and date are no longer shown; the session still belongs to its original day when you save).",
      "Calendars in date dialogs have larger month navigation arrows when the grid is large, a cleaner look when today is also the selected day, and disabled days no longer pick up a gray “filled button” background.",
      "Group pills include clearer accessibility names; delete confirmations and the archived groups/activities drawer were tightened up for reliability.",
      "Activity pills on read-only days (for example when browsing another day’s tasks) line up visually with the interactive version without duplicate layouts.",
      "General polish to buttons and hovers so disabled and interactive states read more consistently across the app.",
    ],
  },
  {
    date: "2026-04-28",
    title: "Smarter Location Tracking and Memo Categories",
    bullets: [
      "Journal entries now support multiple locations in a single day, kept in visit order.",
      "Locations can be reviewed and edited in a dedicated Locations visited dialog.",
      "Add, replace, and delete stops with built-in location search and map preview.",
      "Location chip on the journal stays clickable even before any location is set, so adding locations is faster.",
      "Added category support to memos, so you can now assign a category to a memo and filter memos by category.",
      "Pinned memos are now easier to spot with a pin icon on each memo card.",
    ],
    fixes: [
      "Removed location transition timers to simplify journaling and keep focus on ordered places visited.",
      "Cleaned up location dialog spacing and action placement for a more consistent layout.",
      "Time edit dialog now has a more consistent layout and spacing, and automatically transitions to the next field when the current field is filled.",
      "Activity tracking from 2+ days ago isn't editable anymore.",
    ],
  },
  {
    date: "2026-04-24",
    title: "What's New and Feedback!",
    bullets: [
      "Open What's new from the More menu to see a running history of improvements.",
      "Send feedback and feature requests from More → Feedback / requests.",
    ],
    fixes: [
      "Dialogs are no longer covered by the on-screen keyboard on mobile.",
      "Edit button on groups and activities allows for archiving.",
      "Deleted memos now actually get deleted.",
      "App doesn't force account log off due to bad internet connection.",
      "Previous days' readonly journal activities are now properly rendered.",
      "Saves temporarily changes made to journal and quick task dialogs if accidentally click outside.",
    ],
  },
];
