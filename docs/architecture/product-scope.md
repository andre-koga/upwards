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
- Activities also gain **`is_pinned`** (the user's override of AI ordering). The
  field arrives with the data migrations; the pin control arrives with the
  redesigned Today.
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
- **One confirmation per editing session.** Confirming grants that day a
  10-minute editing session, renewed while the user keeps editing. Taps, blurs,
  and count changes inside it do not prompt again, and the confirmation that
  starts the session records the one revision: the values as they were before
  the session began. "Keep editing" grants nothing and leaves the draft. Timers
  are not day edits (starting from a past day starts today's session).
- **Shipped in A5:** the lock is gone, the prompt, and the revisions
  (recorded, synced, backed up). **Not yet:** the "Previous versions" list with
  restore and the muted "edited" note, both in B3, which reads the revisions
  A5 records.
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

  **Shipped in A10:** the encoder (`lib/journal/video-compression.ts`, using
  Mediabunny over WebCodecs: H.264 + AAC in an MP4, 30 fps, keyframe every second,
  longest edge 1920, orientation preserved, 10 s cap, about 2 Mbps) and a joiner
  (`lib/journal/clip-compile.ts`) that the B7 screen will reuse. Nothing in the
  daily-clip UI changed. Clips already stored (WebM or MP4) are untouched and
  are not re-encoded. If a browser cannot encode H.264 the app refuses to attach
  a clip and says why, rather than storing a different format. If it cannot
  encode AAC the clip is kept without sound.

  **Running the spike.** On the phone, open `/clip-spike` (it is not linked from
  the app), pick a few recorded videos (a long one, a portrait one, one with
  sound), play each result to check sound and orientation, then join 31 clips and
  copy the report. Paste it under "Spike results" below. Also open one old
  Chrome-recorded WebM clip in Safari to check it still plays back.

  #### Spike results

  **Desktop Chrome, 2026-10-06 (automated, macOS, Chrome 154 headless).** Not the
  phone result the spec requires, but it proves the encoder works end to end.
  Sources were generated in the page (VP9/Opus WebM, the kind current Chrome
  records), plus an MP4 with a 90 degree rotation flag like a phone clip.

  | Source | Output | Result |
  | --- | --- | --- |
  | 1280x720, 12 s, with sound | 1280x720 H.264 + AAC, 10.07 s, 1.1 MB, 5.3 s to encode | trimmed to 10 s, sound kept |
  | 720x1280, 4 s, silent | 720x1280 H.264, 0.33 MB, 0.4 s | portrait stayed portrait |
  | 3840x2160, 3 s | 1920x1080 H.264, 0.6 MB, 1.1 s | scaled to the cap |
  | 720x1280 stored sideways, rotation 90 | 1280x720 coded, rotation 90, displays 720x1280 | pixel check: output frame matches the source's displayed frame |
  | a text file | rejected with `no_video` | translated message |
  | 31 clips joined, 1 s each | 1080x1920 H.264, 31.0 s, 3.9 MB, 3.8 s | peak JS heap about 40 MB |

  Every output was a faststart MP4 (`ftyp, moov, mdat`) that Chrome's own video
  element opened at the right size and length. Not covered: sound was checked
  as "an AAC track exists", not by ear; a real phone recording; WebM played
  back in Safari; and low-memory devices.

  #### Phone spike (still to do)

  Needed: a recent iPhone (Safari) and a mid-range Android phone (Chrome).
  Record, per device: whether H.264 and AAC encoding are available, encode time
  against clip length, output size, whether the join of a month completed
  without crashing the tab, and peak memory where the browser reports it. If
  the month join fails, compilation waits and the new clip format still ships.

### 2.6 Accounts required

- The app opens to sign in / sign up. Offline-first behavior after sign-in is
  unchanged: everything applies locally first and syncs later.
- **First launch needs internet.** A fresh install cannot be used until the
  first sign-in; after that it works offline as before. Accepted.
- Until the redesign, the sign-in screen is a minimal full-screen version of
  the existing auth card.
- **Existing guest data** on a device is moved into the account by the existing
  handoff on first sign-in. That code is deleted in the baseline cleanup
  (§4.2, A8). If someone declines, they can export a backup (§2.9) before
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
- Automatic location and the daily clip (§2.5) start as plain Settings toggles.
  Friendly one-time prompts arrive with the redesign's onboarding; nothing here
  waits on onboarding.
- Account settings (`auto_location`, `daily_clip`, `holiday_calendars`,
  `hemisphere`) live on the existing `user_profiles` row so they follow the
  account across devices. Each column is nullable: `null` means "never chosen",
  which is not "off". They are cached in localStorage so the toggles work
  offline and signed out, and are cleared on sign-out and account switch.
- **Shipped in A9:** `auto_location` and `daily_clip` have Settings toggles.
  `holiday_calendars` and `hemisphere` are stored but have no UI until A11.
  Turning automatic location on requests permission right then and stays off
  if refused. Turning the daily clip off hides the video slot, the editor's
  clip controls, the archive's video chip and clip posters; it never deletes a
  recorded clip. An account that has never chosen but already has clips is
  treated as "on" once, so existing video does not vanish.
- Backups carry `daily_clip`, `holiday_calendars` and `hemisphere`, filling only
  what the device has not chosen. **`auto_location` is never restored from a
  backup**: it must be a fresh choice on each device because turning it on
  triggers a permission prompt.
- `user_profiles` read access is own-row only. The old "view any profile"
  policy came from the removed friends feature and would have exposed these
  settings.

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
- **First release:** the US and Brazil national calendars plus the global set
  above. The holiday list is a reviewable data file; the Hindu date table
  covers 2000–2050. More countries are added later as data, not code.
- **Month banners are hemisphere-aware.** The current set is Northern-Hemisphere
  seasons (July is a tropical beach), which is wrong in Brazil. There will be two
  sets of 12, chosen by hemisphere and inferred from the holiday region, with an
  override.
- **Shipped in A11:** the holiday engine and its Settings card (`lib/holidays/`).
  `catalog.ts` defines each holiday once, by id, with an `en` and `pt` name and a
  rule (fixed date, nth weekday, offset from Easter, a `Intl` Chinese, Islamic
  (Umm al-Qura) or Hebrew date, or the Hindu table). `calendars.ts` lists which
  ids each calendar contains: US, Brazil, and a global set. A holiday in two
  calendars shows once, and when two share a day the calendar listed first wins.
  Names follow the reader's language, not the calendar.
  - **Default calendars** come from the region in the locale (`en-US` -> US,
    `pt-BR` -> BR, always plus the global set) and apply only until the user
    chooses. `pt-PT` and `en-GB` get just the global set, because the language
    does not name the country. An explicit empty choice means no holidays.
  - **Hemisphere** is the user's choice, else inferred from the first
    non-global calendar (Brazil is south), else north. Southern months reuse
    the existing twelve images six months along (January shows the beach); the
    label still names the real month. This is a stopgap: it gets the seasons
    right, but the December image is a snowy Christmas scene with lights, so a
    southern June shows that cabin. A dedicated southern set comes with the
    generated banners in B3.
  - **The Hindu table** (`hindu-table.ts`, 2000-2050) was computed from the
    Sun's and Moon's positions and checked against 31 published dates for each
    of Holi and Diwali (2000-2030). Diwali matched all 31. The astronomy for
    Holi differed in three years (2016, 2023, 2026), so those use the published
    date. Holi in 2036, 2043, 2046, 2049 and 2050 depends on a close call
    between rules and may be a day later in some traditions.
  - **`Intl` is a day off the official Lunar New Year in 2027 and 2030**
    (new moons within minutes of midnight in China), so those years are
    overridden. Found by comparing every year 2000-2050 with the astronomical
    new moon. Islamic dates follow Umm al-Qura and can differ from local
    sighting by a day, which is acceptable for a banner.
  - Not in A11: banner images for holidays (B3), more countries (data, later).
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

**Sync first.** Export and import start by pushing pending operations and
pulling. If the device cannot reach a clean state (offline, or pending
operations that will not submit), import is disabled with an explanation. This
is what makes "backup minus current" counts correct.

1. **Bundle format.** Zips built with `fflate`, which can assemble them in
   pieces. Three exports, so a phone never builds one huge file in memory:
   - **Data only** — `backup.json`.
   - **Data + photos** — `backup.json` plus `media/` (journal and memory
     photos, video posters).
   - **Daily clips** — one zip per year.

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
Supabase only in the baseline release (§4.2, A8), after the protocol gate has
turned away the old clients that still send them.

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

Devices report their local schema version with their heartbeat. Because the
audience is small (§4.1), the legacy modules are deleted in the same release
as the baseline, right after a migration window. A device that missed the
window simply takes the reset path when it next opens.

**Lifecycle as timestamps, not event logs.** Replace `activity_status_events`
and `group_status_events` (archive / restore / delete toggles with
`effective_at` intervals, plus a legacy `completed` status) with two
current-state fields on the activity and group rows:
- `archived_at` (new) — set on archive, cleared on restore. Replaces the
  `is_archived` flag and the legacy `completed_at` dual-write.
- `deleted_at` (existing column, already written by permanent delete) — still
  a tombstone, never a hard delete.

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
  merged with memories as one record in the UI (manifesto §3.1); the journal
  and memory tables stay separate.
- Groups and activities with archive → restore → permanent delete (as
  timestamps, §2.10).
- Day navigation: swipe and date picker.
- Month and holiday banners (§2.8), the world map.
- English and Português (Brasil).
- Sync status, conflict review (simplified, §2.10), pending operations, and
  the device list.
- BYO-key AI settings, What's new, feedback, and the PWA install prompt.

## 4. Delivery plan

### 4.1 Operating assumptions

- **Small audience.** Upwards is used by its author and people the author can
  message directly. Data migrations therefore run in a coordinated **migration
  window** (below), not a multi-release rollout. If the app opens to strangers,
  add back: a guest-data migration release, waiting for every device to pass the
  baseline before deleting legacy code, and server-side translation of old
  operation shapes during a grace period.
- **Migrations run on the server.** Every data migration is a Supabase SQL
  migration that also bumps a `data_epoch`. A device that sees a newer epoch
  pushes its pending operations, then re-bootstraps from `pull_sync_snapshot`.
  Devices never run their own data conversions, so they cannot disagree.
- **Old builds are turned away.** The client sends `CLIENT_PROTOCOL` (an integer
  in `lib/sync/sync-constants.ts`, bumped deliberately) to every sync RPC. The
  server rejects anything below `min_client_protocol` with `client_outdated`.
  The app then shows "Update required" and reloads into the new service worker,
  keeping pending operations. Every migration raises the minimum.
- **Two tracks.** Track A (data foundation) changes the current app with no new
  UI beyond removals and minimal pieces. Track B (redesign) builds each new
  screen once, on top of the cleaned model. Track A's UI-facing decisions (type
  question, pin control, previous versions, conflict review) are built only in
  Track B.

**Migration window procedure**

1. Announce the window. Everyone opens the app on every device and waits for
   "All synced".
2. Confirm in SQL that every row in `sync_devices` has been seen since the
   announcement with `pending_count = 0`, or is a device you are deliberately
   abandoning.
3. Take a full backup of your account (§2.9) and a Supabase database backup.
4. Deploy the client release and the server migration together. The migration
   raises `min_client_protocol` and `data_epoch`.
5. Devices update, push, and re-bootstrap.
6. Spot-check counts, streaks, timeline, and journal against the backup on two
   devices.

A device that missed the window is caught by the version gate and, after A8,
by the recovery-bundle reset path. Nothing it holds is discarded silently.

### 4.2 Track A — data foundation

Each item is one pull request unless noted. "Done" always also means `tsc -b`,
ESLint, Vitest, and the integration suite pass, user-visible changes appear in
What's New in `en` and `pt`, and nothing in
[`temporal-data-sync.md`](temporal-data-sync.md) is contradicted.

**A1. Release gates.** Protocol version, data epoch, device heartbeat.
- Server: an `app_config` row with `min_client_protocol` and `data_epoch`.
  `submit_sync_operations`, `pull_sync_operations`, and `pull_sync_snapshot`
  take `p_client_protocol` (defaulting to 0, so old builds are rejected once
  the minimum is above 0) and return `data_epoch`. `sync_devices` gains
  `client_protocol`, `local_schema_version`, and `pending_count`.
- Client: send the protocol on every call. Handle `client_outdated` with an
  "Update required" screen. Store the last seen epoch; on a newer one, push and
  then snapshot. Report the heartbeat fields.
- Tests: integration (outdated protocol rejected; epoch bump causes snapshot
  bootstrap with no lost pending ops); unit tests for the client handling.
- Done when: raising `min_client_protocol` in SQL makes an older build show
  "Update required" and its pending operations survive the update.

**A2. Backup correctness** (§2.9).
- Move `components/settings/use-data-backup.ts` into `lib/backup/` (`format.ts`,
  `export.ts`, `import.ts`, `migrators/`). Rewrite `importBackup` in
  `lib/sync/mutate-synced.ts`. Add `fflate`. Re-enable `backup-card.tsx`.
- Sync first; three exports; operation IDs derived from row identity; counts as
  differences; journal differences as conflicts; media upload deduped by content
  hash.
- Tests: round trip; import twice is a no-op; import into a non-empty account
  does not double counts; a coverage test that fails when a user-owned Dexie
  table is missing from the format.
- Done when: the three tests pass, and a manual export → import on a phone and
  a desktop restores data and photos.

**A3. Removals with no data change.**
- Palettes (`lib/themes.ts`, `lib/palette.ts`, `appearance-card.tsx`; clear the
  stored key), the quote footer (`lib/habit-quotes.ts`), hearted gradient
  washes, Logs and GitHub moved to Settings › About.
- Session details lose timed ⇄ untimed conversion; manual entry requires start
  and end.
- Done when: nothing references the removed modules, and the existing session
  and manual-entry tests are updated to the reduced behavior.

**A4. Midnight days and the overlap helper** (§1 day-reset row, §2.2).
- Delete `lib/session/day-reset.ts` and `day-reset-card.tsx`. Replace
  `getEffectiveToday()` with the local date across its ~26 callers. Turn
  `use-day-reset-timer.ts` into a UI-only midnight timer.
- Reduce `lib/activity/period-day-utils.ts` to `sessionsOnDay` and
  `sessionShareOfDay`. The timeline, totals, streaks, and the AI payload all
  use them.
- What's New explains that 00:00–04:00 now belongs to the new day.
- Tests: cross-midnight and DST shares sum to the full duration; a running
  session started yesterday appears on today.

**A5. Editable past, confirmation, revisions** (§2.3, §2.4).
- Delete `lib/journal/editable-window.ts` and the locked-session paths. Saving
  changes to a day older than 7 days asks for confirmation via `AlertDialog`.
- Server and Dexie: a `journal_entry_revisions` table with RLS, an append-only
  revision operation, and a `mutateSynced` command. Photo and clip deletion
  skips objects that a revision references. Revisions are recorded now; the
  restore UI comes in B3.
- Derive the journal streak; stop writing `journal_completion_streak` and
  `journal_entry_number`.
- Tests: two devices append one revision each and both see both; the
  confirmation threshold; a backfilled day heals the streak.

**A6. Migration window 1: model cutover** (§2.1, §2.2, §2.10). Two PRs that
ship together in one window: A6a (server) and A6b (client).
- A6a — Supabase migration:
  - add `activities.tracks_time`, `activities.is_pinned`, and `archived_at` on
    activities and groups;
  - convert recurring memos into "Routines" activities, hidden group
    activities into named ones (the group's name, or "Group · general" on a
    clash), and lifecycle events into timestamps (a legacy `completed` status
    counts as archived);
  - set `tracks_time = false` on avoid habits;
  - for zero-length sessions, the day's count is the truth: the session donates
    its time and note to `completion_times` / `completion_notes` only when that
    day's count reached the target, and is otherwise ignored; nothing is
    deleted;
  - make the status-event and `recurring_memo` tables read-only, and reject
    their operation types in `submit_sync_operations`;
  - stop requiring `activity_periods.daily_entry_id` and stop creating
    daily-entry shells;
  - raise `min_client_protocol` and `data_epoch`.
- A6b — client:
  - delete `lib/activity/status-events.ts`, `lib/memos/spawn-recurring-memos.ts`
    and the recurring memo dialogs, `lib/activity/hidden-default.ts`, and the
    `isUntimedPeriod` read paths;
  - archive and restore write `archived_at`;
  - Today hides the timer when `tracks_time` is false, and the current
    activity dialog gets a minimal "Track time" switch until B2;
  - stop writing `is_journal_complete`, `journal_completed_at`,
    `current_activity_id`, and the always-null columns;
  - sessions are queried by time.
- Tests: each SQL step is idempotent (run twice, same result); a two-device
  integration test after cutover; past days render archived and deleted items
  correctly.
- Done when: the window procedure (§4.1) is executed and spot-checked.

**A7. Accounts required** (§2.6).
- Unauthenticated users see the minimal sign-in screen. The existing handoff
  moves guest data on first sign-in.
- Done when: a fresh install requires sign-in; a guest device signs in and keeps
  its data; signed-in offline use is unchanged.

**A8. Baseline schema and legacy deletion** (§2.10). Migration window 2.
- Dexie: collapse `lib/db/index.ts` to one baseline version. Pre-baseline
  devices take the recovery path (push, recovery bundle in the A2 data-only
  format, delete, snapshot, re-import).
- Delete: `lib/sync/identity-repair.ts`, `lib/journal/dedupe-by-date.ts` and its
  reconcile pass, the `sync-storage.ts` heal step, the cutover flags and
  enqueue, and the guest code (`auth-handoff.ts`, `guest-handoff-emitter.ts`,
  `rekey-guest-rows`, `auth-data-handoff-dialog.tsx`).
- Supabase: drop the dead columns listed in §2.10. Keep the read-only legacy
  tables.
- Tests: a seeded old-version IndexedDB recovers with no double counts; the
  suite passes with the modules deleted.

**A9. Account settings and opt-ins** (§2.5, §2.7).
- `user_profile` columns from §2.7 and Settings toggles. Automatic location is
  off by default and makes no geolocation or geocoding calls while off. The
  daily clip toggle hides the video slot, the video filter, and posters.
- This can land any time after A1.

**A10. Daily clip encoder, then the compilation spike** (§2.5).
- Replace `lib/journal/video-compression.ts` with WebCodecs encoding (via
  Mediabunny or an equivalent muxer) to H.264/AAC MP4.
- Run the spike on a recent iPhone and a mid-range Android phone; record the
  results in this document. The compilation UI is B7.

**A11. Holiday engine** (§2.8).
- Replace `lib/journal/holidays.ts` with calendar data files: US, Brazil, the
  global set, and the 2000–2050 Hindu table. Rules: fixed dates, Easter, and
  `Intl` calendars. Hemisphere-aware month selection, with calendars chosen
  from A9's settings. Banner images are generated in B3.

Dependencies: A1 comes first. A2 before A6, so trustworthy backups exist.
A3, A4, A5, A9, A10, and A11 are independent of each other after A1. A6
before A7, and A7 before A8.

### 4.3 Track B — redesign

Track B gets its own breakdown before it starts. Its shape:

- **B0.** Mock the screens the flagship lacks: previous versions, conflict
  review, the activity type question, sign-in, onboarding.
- **B1.** Adaptive shell and navigation (Home / Today / Journal / You, `⌘K`).
  Reconcile with the existing `cursor/adaptive-app-shell-5a78` branch first.
- **B2.** Today: activity rows, the type question, the pin control, AI
  ordering with reasons and a no-AI fallback. Then remove the task-order page.
- **B3.** Journal: one record across the journal and memory tables (the merge is
  UI-only; the tables stay separate). Feed, calendar, map, and gallery;
  previous versions with restore; generated month and holiday banners.
- **B4.** Home: AI insight surfaces on the existing AI groundwork.
- **B5.** You / compass and onboarding, including the one-time daily clip and
  location prompts. The compass needs a data-model pass in
  [`temporal-data-sync.md`](temporal-data-sync.md) before code.
- **B6.** Conflict review rebuilt with the §2.10 resolution shapes, replacing
  the per-field card and resolvers.
- **B7.** Month and year clip compilations, if the A10 spike passed.
- **B8.** Settings and sign-in restyled.
