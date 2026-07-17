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
    date: "2026-07-17",
    title: "Theme-aware chrome & journal polish",
    bullets: [
      "On an installed phone app, the top and bottom bars match your theme.",
      "Journal entries show media on top, day number beside your writing, and photos in a grid.",
      "Month banners with seasonal images (and holiday banners) mark the journal feed as you scroll.",
    ],
  },
  {
    date: "2026-07-17",
    title: "Journal archive",
    bullets: [
      "Open Journal from the menu to scroll through every day you've written — emoji, text, photos, and video in one timeline.",
      "Search by words, emoji, places, or dates, and jump straight into any day by tapping it.",
    ],
  },
  {
    date: "2026-06-28",
    title: "Recurring memos",
    bullets: [
      "Set memos to repeat on a schedule and they'll show up on your list automatically when they're due.",
    ],
  },
  {
    date: "2026-06-27",
    title: "Stats, refined",
    bullets: [
      "Time-of-day charts now stack by activity (in a group) or by group (on the overview), so you can see what filled each hour instead of one solid bar.",
      "Groups and activities sit right under the 90-day heatmap with sparklines, tracked time, and completion at a glance.",
      "Break days show on sparklines with a small amber mark at the bottom of each day.",
      "Tap a group or activity row to drill in — a chevron shows the way.",
    ],
    fixes: [
      "Group sparklines now count never habits toward completion.",
      "Break days on the overall heatmap show your real completion rate, not 100% by default.",
      "Activity heatmap break days use the same amber styling as off days.",
    ],
  },
  {
    date: "2026-06-23",
    title: "Habit stats, rebuilt",
    bullets: [
      "The Stats page is your performance hub — weekly completion, streaks, a 90-day heatmap, and where your time goes by group.",
      "Open any group to compare habits with sparklines and trends, then dive into one habit for session history, records, and patterns.",
      "Tap a group in Projects to peek at its stats without leaving your day.",
      "Each habit has a compound score that rises with wins and falls with misses — one number that tracks real momentum.",
      "Time-of-day charts reveal when you usually work on habits, from the overview down to a single habit.",
      "Monthly completion trends chart your last year — overall and broken out by group on one view.",
      "The 90-day heatmap is clearer: solid wins, outlined misses, dashed breaks, muted off days.",
    ],
    fixes: [
      "Never habits no longer show break days on the heatmap.",
    ],
  },
  {
    date: "2026-06-10",
    title: "Activity stats and a smarter day boundary",
    bullets: [
      "Tap any habit to see its stats: streaks, a 90-day heatmap, and a by-day-of-week chart.",
      "Stats adapt to the habit type — timers show session lengths, check-off habits show success rate, 'never' habits show clean days.",
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
    ],
  },
  {
    date: "2026-06-02",
    title: "Friends and notifications",
    bullets: [
      "Add friends by username; the bell inbox handles friend requests.",
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
