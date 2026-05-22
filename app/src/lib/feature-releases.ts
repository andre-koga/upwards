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
    date: "2026-05-20",
    title: "Goals, Friends, and a unified inbox",
    bullets: [
      "Tap any habit name on For Today to set a personal Goal — a simple way to commit to showing up for that habit.",
      "Optionally invite friends from the Goal dialog for extra accountability; they see when you complete the habit.",
      "Friends page (More → Friends): add people by exact username when you want to share Goals with them.",
      "Notifications inbox (bell, top right): friend requests, Goal invites, and partner completions in one place.",
      "When you share a Goal, partners get a subtle \"✓\" or \"○\" on For Today for linked habits.",
      "Mark habits as done from the Projects drawer — completed habits stay on For Today through the day you finish them, then roll off starting the next day.",
      "Browse past days on For Today and see what was actually active that day: completed and deleted habits stay visible on the days they matter, without cluttering today.",
    ],
    fixes: [
      "Simplified codebase: removed token-based invite flow, reactions feature, and several over-engineered tables. Everything now uses a single clean path.",
      "Display names and usernames now load reliably (no more 'Member / them' placeholder text).",
      "Partner status resets properly when you switch days or leave a goal — no stale chips.",
      "Duplicate progress events on the same day are safely deduplicated at the database level.",
      "Projects drawer timers now show correct per-day elapsed time instead of 00:00.",
      "Creating a new group no longer immediately opens the edit dialog afterward.",
      "Deleted habits on past days are read-only — no checkbox, play button, or goal controls where the habit is already gone.",
      "Sync no longer fails when you delete an activity that had streak data.",
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
