# Product Scope Decisions

**Status:** binding — decided 2026-10-01.

Upwards is pivoting from "a place that stores your days" to "a place that reads
your days back against who you want to become" (see
[`design-and-branding.md`](design-and-branding.md) §1). An app that does
everything cannot do any one thing especially well, so every shipped feature was
reviewed against two questions:

1. Does it feed the record or the compass, or help the user act on them?
2. Is its technical cost (sync rules, migrations, edge cases, media) proportional
   to what the user gets?

This document is the written record that
[`design-and-branding.md`](design-and-branding.md) §3.4 requires whenever a
shipped feature is removed or reshaped. It is the source of truth for scope;
the manifesto's coverage list is derived from it. Data-model consequences are
reflected in [`temporal-data-sync.md`](temporal-data-sync.md).

Reintroducing anything listed under "Removed" requires updating this file first
with the product tradeoff that changed.

---

## 1. Removed

| Feature | Why it goes | Technical consequence |
|---|---|---|
| **Nine named color palettes** (Cyberpunk, Pastel Dreams, …) | The brand is a specific warm palette plus a gradient reserved for the AI. Nine palettes multiply every design check by ten and break the gradient's meaning. | Ship System / Light / Dark only. Delete the palette options in `lib/themes.ts`, `lib/palette.ts`, and the palette picker. The `upwards-color-palette` localStorage key is ignored and cleared. Group colors are user data and stay. |
| **Random habit-quote footer** on Today | Decorative filler; the manifesto's anti-goals forbid ornament that is not information. | Delete `lib/habit-quotes.ts` and its render in `pages/today.tsx`. |
| **Gradient washes on hearted journal entries** | Gradients mean "the AI did this". Six decorative gradients dilute that. | Hearted entries show a heart marker only. |
| **Per-day activity pause** | Stored, synced, and honored by streaks, but no UI can create it — dead code. | Stop emitting pause ops and remove `paused_task_ids` writes from import. Historical pause facts keep their effect on past streaks; the server keeps accepting already-recorded pause ops so replay stays idempotent. |
| **Journal entry number** (`journal_entry_number`) | Computed, synced, and re-propagated, but never shown. | Stop reading and writing it. The column stays nullable until a later schema cleanup. |
| **Hidden group-default activity** (timing a group without naming an activity) | An invisible concept with sentinel values (`name === null`, `__group_default_hidden__`) handled across sync, streaks, and the timeline. | One-time migration: each hidden activity that has sessions becomes an ordinary visible activity named after its group. History is preserved. Delete `lib/activity/hidden-default.ts`. Timing now always targets a named activity; the start sheet offers quick-create. |
| **Timed ⇄ untimed conversion** in session details | Untimed completions are derived from counts, not stored rows ([`temporal-data-sync.md`](temporal-data-sync.md) merge rule 7). "Converting" a session into a completion contradicts the model and is the source of most special cases. | Session details edit activity, start, end, and note, or delete. A completion's time is edited from the task itself. |
| **End-only manual time entry** (meaning "untimed") | Same reason: it is a hidden second way to create a completion. | Manual entry requires start and end. To record "done at 9pm" without a duration, check the task and set its completion time. |
| **Guest mode** (using the app without an account) | The AI needs an account, and the guest identity, rekeying, and guest→account handoff are among the most fragile code paths. | An account is required. See §2.6 for the one-time migration. Afterwards, delete `lib/sync/auth-handoff.ts`, `guest-handoff-emitter.ts`, `rekey-guest-rows`, `components/settings/auth-data-handoff-dialog.tsx`, and the `guest:{device_id}` identity. |
| **Standalone Task Order page** (`pages/task-order.tsx`) | Ordering is now done by the AI with an explanation per task, and the user overrides by pinning. A separate global up/down list is a second, competing ordering system. | Remove the page and its Settings entry. Fallback order when the AI is not configured: pinned → not yet done → existing `order_index`. `order_index` stays in the schema but is no longer editable. |
| **Configurable day-reset hour** (default 4 AM, up to 8 AM) | A day that ends at an arbitrary hour forces every date calculation through an "effective today" layer: render-time clipping of sessions, boundary labels, and logical-day math in streaks, the journal, memos, and AI aggregation. The setting also lives in device `localStorage`, so two devices could disagree about which day it is. | Days always end at local midnight. Delete `lib/session/day-reset.ts` and `components/settings/day-reset-card.tsx`, and reduce `lib/activity/period-day-utils.ts` to the single midnight-based overlap helper (§2.2). `getEffectiveToday()` becomes the plain local date. The day timer (`hooks/use-day-reset-timer.ts`) becomes a UI-only midnight timer that rolls Today over and runs memo carry-forward. No rewrite of past facts: counts, break days, and journal entries stay on the dates they were recorded on. **Behavior change:** because the old default was 4 AM, anything done between midnight and 4 AM now belongs to the new day. The lifted edit lock (§2.3) makes it easy to log a late-night item on yesterday instead. |
| **Per-field conflict merging** | Choosing field by field between two versions of a habit is precision nobody needs for a rare, low-stakes conflict, and it costs about 1,600 lines. | Whole-item choice, plus "keep both" for journal text. See §2.10. |
| **Error Logs and GitHub link in the main menu** | Developer tools in a personal-life app's primary navigation. | Both move to Settings › About. The `/logs` route stays for support. |

## 2. Changed

### 2.1 Recurring memos become check-only activities

Recurring memos existed for things like medication: something that repeats on a
schedule but is not "work" you time. That is a scheduled activity that does not
track time. The real gap was that every activity was timeable.

- Activities gain a current-state field **`tracks_time`** (boolean, default
  `true`). When `false`, the activity shows no start/stop control, never
  creates sessions, and never appears in session pickers. It still has a
  routine, a target (`2` for twice-daily meds), counts, completion times, and a
  streak.
- One-time, idempotent migration: each `recurring_memo` becomes an activity with
  `tracks_time = false`, the same routine, `completion_target = 1`, pinned if it
  was pinned, archived if it was disabled. Migrated items go into a group named
  "Routines", which the user can rename. Memos already spawned stay as one-time
  memos, so history is untouched.
- Then remove `lib/memos/spawn-recurring-memos.ts`, the recurring memo dialogs,
  and the spawn step at day change. The `recurring_memo` table stops receiving
  writes.
- **One-off memos stay** (quick add, due date, pin, carry-forward, archive):
  simple tasks are genuinely useful and feed the AI.
- **The activity form asks one "type" question** instead of exposing routine,
  target, and `tracks_time` as independent switches, several combinations of
  which are meaningless:

  | Type | Schedule | Target | Timer |
  |---|---|---|---|
  | **Habit** | daily / weekly / monthly / custom interval | 1, or more for a counter | optional toggle (off for meds) |
  | **Avoid** | routine `never`; logs slips | — | always off |
  | **Time-only** | routine `anytime`; no schedule, no streak | — | always on |

  The stored fields do not change; the form maps the type onto them, and save
  normalizes invalid combinations. The `tracks_time` migration sets it to
  `false` for existing avoid habits. Sessions already recorded on them stay as
  facts.

### 2.2 Time tracking: the whole rule set

Time tracking stays. The principle is `duration = end − start`, and the rules
are reduced to this list. Any rule not on it should be removed rather than
documented.

1. A **session** is `{activity, start, end (null while running), note}`.
   Duration is `end − start`. A session always has `end > start`.
2. **One session runs at a time.** Starting another stops the current one at
   the same instant. The running session is the one with `end = null`; no
   separate "current activity" state.
3. **A day is a local calendar date, midnight to midnight.** There is no
   configurable day boundary (see §1).
4. **Sessions are stored as they happened and never split or auto-stopped.**
   Each day's view computes its share at read time. One pure helper owns this,
   and the timeline, day totals, week stats, and the AI payload all call it:
   - A session is on a day when `start < dayEnd && (end ?? now) > dayStart`.
   - Its time on that day is `min(end ?? now, dayEnd) − max(start, dayStart)`.
   - `dayStart`/`dayEnd` are local midnights computed with calendar arithmetic
     in the device's time zone, never "start + 24h", so DST days are 23 or 25
     hours.

   A session that crosses midnight appears on both days. Each row shows its
   real times with a quiet "from yesterday" or "continues tomorrow" marker,
   and each day's total counts only that day's share, so totals across days add
   up exactly. Editing or deleting acts on the one session, and the dialog says
   when it spans two days. The running pill shows the session's full elapsed
   time.

   Nothing is written at midnight: no splitting, no catch-up, no migration, no
   generated IDs. The only midnight timer is a UI one that rolls Today over to
   the new date.

   Auto-stopping at midnight was rejected. It silently loses real time
   (23:00–01:00 would record one hour), and because the app is often closed
   at midnight it still needs a catch-up write on next launch.
5. A session shorter than **5 seconds with no note** is discarded when the user
   stops it, as an accidental tap.
6. **Completions are not sessions.** Checking a task records a count, with an
   optional completion time, on the day. The timeline shows derived "done at
   HH:MM" rows next to real sessions. Legacy zero-length period rows are folded
   into completion times by a one-time migration and no longer read as periods.
   They are not hard-deleted.
7. **Overlaps** can only come from manual edits. They are shown inline on the
   timeline rows involved, not raised as sync issues.
8. Kept as-is: the live running pill, the timeline with day total, session
   notes, manual entry (start + end), reassigning an activity, delete, the ▶
   "start again" button on timeline rows (it calls the normal start), and the
   unknown-activity repair for orphaned sessions.

### 2.3 Editing past days: no lock, confirm + revisions

The 7-day edit window existed to prevent accidental damage to old entries, not
to forbid editing. It is replaced with protection that does not block anyone:

- **Every day is editable** — journal, counts, sessions, completions.
- Saving a change to a day **older than 7 days** asks for confirmation that names
  the date and what changes ("Save changes to Tue, 14 Mar 2025? Text and 1
  photo removed."). Hearting and adding a place skip the prompt, since neither
  destroys anything.
- **Journal revisions.** When a confirmed edit overwrites an old entry's title,
  emoji, text, or media list, the previous values are kept as an append-only
  revision (`journal_entry_revisions`, union by UUID). The entry menu offers
  "Previous versions" with restore. Storage objects referenced by any revision
  are not deleted.
- An entry's date is always `entry_date`; editing never moves it in the record.
  A muted "edited 2 Oct 2026" note shows when an old entry was changed.
- Remove `lib/journal/editable-window.ts` and the `isLockedHistoricalSession`
  read-only paths.

### 2.4 Journal streak stays, derived

The journal streak helps people keep the habit, and backfilling a forgotten day
is legitimate — so the streak stays and the completion rule (emoji + title +
text) stays.

- The streak is **derived on read** from completed entries, like activity
  streaks. Stop storing `journal_completion_streak` on the row and stop
  re-propagating it. Storing it violates
  [`temporal-data-sync.md`](temporal-data-sync.md) invariant 6.
- Backfilling a past day completes it and heals the streak. That is intended.
- Answering an AI journal prompt writes into the same title/text fields, so it
  counts toward completion. The AI payload reads the same derived streak
  function as the UI; there is one implementation.

### 2.5 Daily clip: opt-in video, built for compilation

Video stays but stops being a default part of every day. Some people only want
photos.

- **Daily clip** is a setting, off by default and offered once during
  onboarding. When off, the day shows no video slot, and the feed's video filter
  and the Gallery's video posters are hidden. When on: one clip per day, 10
  second cap, as today. Photos (up to 8) are always available.
- **Fix the stored format now.** Today's `lib/journal/video-compression.ts`
  re-records the clip in real time through a canvas and `MediaRecorder`, so the
  container and codec depend on the browser (WebM on Chrome, MP4 on Safari) and
  size varies. Clips will be encoded with WebCodecs (via a muxing library such
  as Mediabunny) into one canonical format: H.264 video + AAC audio in MP4, fixed
  frame rate, normalized long-edge size, orientation preserved. This change is
  valuable even if compilation never ships.
- **Month and year compilations (1 Second Everyday style)** are the goal: for
  each clip, use a short segment (default 1 s; the user can pick the moment per
  day), concatenate on-device, and offer the result to save or share. The result
  is not stored server-side, so it costs no storage and can be regenerated.
- **Gated on a spike.** Before building the UI, prove on a recent iPhone (Safari)
  and a mid-range Android phone (Chrome) that a month compile completes without
  crashing the tab. The spike must also prove that existing clips, including
  Chrome-recorded WebM played back on Safari, can be decoded, and that audio
  encoding works on Safari. If audio encoding is unavailable, the compile falls
  back to silent output. If the spike fails, the daily clip still ships with
  the new format and compilation waits.

### 2.6 Accounts required

- The app opens to sign in / sign up. Offline-first behavior after sign-in is
  unchanged: everything applies locally first and syncs later.
- **One-time migration** for devices that hold guest data: on first launch after
  the change, the user is asked to sign in and the existing handoff imports
  their local data into the account. That release is the last one carrying
  handoff code. If someone declines, they can export a backup (§2.9) before
  anything is cleared — no wipe without an explicit choice.
- Sign-out and account switching keep the existing guarantees: no local wipe
  while operations are unacknowledged, unless the user syncs, exports, or
  explicitly discards.
- AI surfaces lose their "signed-out" state; "offline" replaces it.

### 2.7 Places: automatic location is opt-in

- "Add my location to today automatically" is a setting, **off by default**.
  Turning it on requests browser permission. When off, the app makes no
  geolocation calls and no reverse-geocoding requests.
- Manual place search, up to 5 places per day, the per-day map, and the world map
  all stay.

### 2.8 Holidays and month banners: kept and widened

- **Holiday calendars are chosen in Settings**, separately from UI language. Today
  `en` means US holidays and `pt` means Brazil, which is wrong for a Portuguese
  speaker in Portugal or an English speaker in Brazil. The default is inferred
  from locale; the user can enable several calendars.
- Ship a **curated set of major world holidays** (for example Lunar New Year,
  Carnival, Holi, Easter, Ramadan start, Eid al-Fitr, Eid al-Adha, Diwali,
  Hanukkah, Day of the Dead, Thanksgiving, Christmas, New Year) alongside the
  existing national calendars. Dates come from fixed-date rules, the existing
  Easter algorithm, `Intl.DateTimeFormat` with the `chinese`, `islamic-umalqura`,
  and `hebrew` calendars, and a precomputed table for Hindu lunisolar dates,
  which `Intl` does not cover. Islamic dates can differ from local observance by
  a day; that is acceptable for a banner.
- **Month banners are hemisphere-aware.** The current set is Northern-Hemisphere
  seasons (July is a tropical beach), which is wrong in Brazil. There will be two
  sets of 12, chosen by hemisphere and inferred from the holiday region, with an
  override.
- **Holiday banners get images too**, generated once with AI as static assets in
  one art direction shared with the month set: warm, natural, photographic or
  painterly, muted enough to sit on `--paper`, no text in the image, no pastel or
  cartoon style. Served as compressed WebP, lazy-loaded, with i18n alt text.

### 2.9 Backup: ship it, and make it correct

JSON export/import is built but hidden, and it is not correct as written:

- **Import is not idempotent.** It overwrites local daily entries and then
  enqueues count deltas from 0 → backup count, so importing into an account that
  already has those days adds counts on top. Re-importing the same file doubles
  them again. This violates the sync invariants.
- It omits media (backups contain storage paths, not files), any table added
  after format version 4, and settings. Its messages are hardcoded English.

Required behavior:

1. **Bundle format.** A `.zip` containing `backup.json` and a `media/` folder
   (photos, clips, posters, memory photos), plus a lighter "data only" export.
   Never include the AI API key.
2. **Complete coverage.** Every user-owned table and account setting, including
   journal revisions, the compass and knowledge map, and lifecycle timestamps.
   Add a test that fails when a new user-owned Dexie table is not in the backup.
3. **Versioned with migrators.** Each format version has a migrator to the next.
   Importing an old file runs the same scope migrations as live data (recurring
   memos → activities, hidden group activity → named activity, zero-length
   periods → completion times, status events → lifecycle timestamps). These
   migrators are also the only upgrade path for devices on a pre-baseline local
   schema (§2.10), so legacy row shapes are understood in exactly one place.
4. **Idempotent merge, through the sync command API.** Operation IDs are derived
   from the backup's row identity, so re-importing is a no-op. Counts are
   imported as the difference between the backup and current state, never as
   "+N from zero". Sessions and events union by ID. Media dedupes by content
   hash. A journal date that already has different text becomes a reviewable
   conflict on Sync issues, never a silent overwrite.
5. **Tests.** Export → clear → import equals the original. Import twice changes
   nothing. Importing into a non-empty account merges without double counts.
6. All copy through i18n in `en` and `pt`.

### 2.10 Data model and sync cleanup

The scope decisions above leave behind storage and sync code that exists only
for features or designs that are gone. Each item below departs from an earlier
rule in [`temporal-data-sync.md`](temporal-data-sync.md), which records the
new rule.

**Sessions stand alone.** A session is `{activity, start, end, note}` and no
longer references a daily-entry row: day membership is computed from time
(§2.2). Stop writing `activity_periods.daily_entry_id`. The server no longer
creates an empty `daily_entries` row when a session arrives without one. Local
queries index `start_time`/`end_time` instead of the daily-entry link, and the
overlap check in `lib/sync/timeline-overlap.ts` works by time.

**Store facts, derive everything else.** Stop storing values that are a pure
function of other data:
- `journal_entry.is_journal_complete` and `journal_completed_at` — completion
  is "emoji, title, and text are all present".
- `daily_entries.current_activity_id` — the running session is the one with
  `end` null.

Stop writing always-null or superseded columns: `activity_groups.emoji`,
`one_time_task.group_id`, `one_time_task.recurring_memo_id` (after §2.1),
the `activities.completed_at` archive dual-write, and reads of the legacy
`pattern` / `__group_default_hidden__` sentinels. Columns are dropped from
Supabase only after the baseline gate below, so old clients that still send
them do not fail.

**One baseline local schema.** `lib/db/index.ts` carries 30 Dexie versions of
upgrade steps. Several sync modules exist only to repair data from earlier
designs:
- `lib/sync/identity-repair.ts` and the natural-ID cutover flags;
- `lib/journal/dedupe-by-date.ts` and its reconcile pass, which merge
  same-date journal duplicates that deterministic IDs now make impossible;
- the heal step in `lib/sync/sync-storage.ts`;
- the one-shot cutover enqueue.

All of it is replaced by a single baseline schema plus a reset path for devices
older than it:
1. Before Dexie opens, read the installed IndexedDB version. If it predates the
   baseline, first push whatever pending operations still submit.
2. Read every local row with raw IndexedDB and keep it as a recovery bundle
   (same format as a data-only backup), offered for download.
3. Delete the local database, sign in, and bootstrap from the server snapshot.
4. Import the recovery bundle through the idempotent backup import (§2.9).
   Anything that differs from the server lands on Sync issues; nothing is
   silently dropped.

Devices report their local schema version with their heartbeat. The legacy
modules above are deleted once no device seen recently reports a pre-baseline
version. Any device that reappears later simply takes the reset path.

**Lifecycle as timestamps, not event logs.** Replace `activity_status_events`
and `group_status_events` (archive / restore / delete toggles with
`effective_at` intervals, plus a legacy `completed` status) with two
current-state fields on the activity and group rows:
- `archived_at` — set on archive, cleared on restore.
- `deleted_at` — set on permanent delete from the archive; still a tombstone,
  never a hard delete.

A past day shows an activity when it existed then and was not yet archived or
deleted: `created_at ≤ day < (archived_at ?? deleted_at ?? ∞)`. This keeps the
retired-activity explanation on past days. It applies the existing "past days
use the current definition" rule to lifecycle too.

**Accepted cost:** archiving in January and restoring in March makes February
show the activity as scheduled and missed. Break days and the editable past
(§2.3) cover that rare case.

Migration: fold each entity's events into the two timestamps (a currently open
archive interval sets `archived_at`; a legacy `completed` status counts as
archived). The client stops reading and writing the event tables. The server
keeps them read-only rather than dropping them, so the old interval history is
not destroyed.

**Simpler conflict review.** Conflicts stay reviewable in the app, but the
per-field keep-mine / keep-theirs / combine UI and its two resolvers (about
1,600 lines across `components/settings/conflict-review-card.tsx`,
`lib/sync/projection-conflict-resolution.ts`, and
`lib/sync/journal-conflict-resolution.ts`) shrink to two shapes:
- **Activities, groups, memos:** show both versions with differing fields
  highlighted; choose "keep this device's" or "keep the other". These conflicts
  are rare and low-stakes.
- **Journal:** side-by-side text with "keep mine", "keep theirs", or "keep
  both". "Keep both" joins the two texts with a divider, opens the result for
  editing, and unions photos and places.

Each resolution is an ordinary operation through `mutateSynced`, so it syncs
and can be revised like any edit.

## 3. Kept on purpose

These were considered and stay because they serve the record, the compass, or
the user's ability to act:

- Checkbox, counter, and never/avoid habits; anytime activities; routines
  (daily, weekly, monthly, custom interval, anytime, never).
- Per-activity streak flames and the break day.
- One-off memos.
- Start/stop time tracking and the sessions timeline (rules in §2.2).
- The journal with emoji, title, text, up to 8 photos, places, and hearting,
  merged with memories as one record (manifesto §3.1).
- Groups and activities with archive → restore → permanent delete (as
  timestamps, §2.10).
- Day navigation: swipe and date picker.
- Month and holiday banners (§2.8), the world map.
- English and Português (Brasil).
- Sync status, conflict review (simplified, §2.10), pending operations, and
  the device list.
- BYO-key AI settings, What's new, feedback, and the PWA install prompt.

## 4. Order of work

The cuts touch different subsystems. Do them in this order, so that each data
migration lands before the code that depended on the old shape is deleted:

1. **Pure UI cuts** — palettes, quote footer, hearted gradients, Task Order page,
   menu cleanup. No data changes.
2. **Backup correctness** (§2.9) — idempotent import plus round-trip tests,
   before any migration, so users can take a trustworthy backup first.
3. **Data migrations** — recurring memos → check-only activities (Supabase
   column `tracks_time` plus Dexie version bump), hidden group activity → named
   activity, zero-length periods → completion times, status events → lifecycle
   timestamps. Stop writing the entry number, stored journal streak and
   completion flag, `current_activity_id`, the session → daily-entry link, and
   the always-null legacy columns (§2.10). Each migration is idempotent and
   covered by a two-device test.
4. **Rules and lock** — midnight day boundary with the single overlap helper
   and removal of the day-reset setting, the rest of the time-tracking
   simplification (§2.2), edit-lock removal with confirmation and journal
   revisions (§2.3), derived journal streak (§2.4), the activity type question
   (§2.1), and the simplified conflict review (§2.10).
5. **Accounts required** (§2.6) — ship the migration release, then delete the
   guest code in the next one.
6. **Baseline schema** (§2.10) — ship the baseline plus the reset path, add the
   schema version to device heartbeats, and once no recent device is
   pre-baseline, delete the legacy repair modules and drop the dead Supabase
   columns.
7. **Opt-ins** — automatic location (§2.7) and daily clip with the new encoder
   (§2.5).
8. **Holidays and banners** (§2.8), then the compilation spike.
