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
  and the day-reset spawn step. The `recurring_memo` table stops receiving
  writes.
- **One-off memos stay** (quick add, due date, pin, carry-forward, archive):
  simple tasks are genuinely useful and feed the AI.

### 2.2 Time tracking: the whole rule set

Time tracking stays. The principle is `duration = end − start`, and the rules
are reduced to this list. Any rule not on it should be removed rather than
documented.

1. A **session** is `{activity, start, end (null while running), note}`.
   Duration is `end − start`. A session always has `end > start`.
2. **One session runs at a time.** Starting another stops the current one at
   the same instant. The running session is the one with `end = null`; no
   separate "current activity" state.
3. A session **belongs to the logical day it starts in** (after the
   configurable day-reset hour). Sessions that cross the boundary are not split
   or shown on two days. This replaces the current overlap-based day membership.
4. A session shorter than **5 seconds with no note** is discarded on stop as an
   accidental tap.
5. **Completions are not sessions.** Checking a task records a count, with an
   optional completion time, on the day. The timeline shows derived "done at
   HH:MM" rows next to real sessions. Legacy zero-length period rows are folded
   into completion times by a one-time migration and no longer read as periods.
   They are not hard-deleted.
6. **Overlaps** can only come from manual edits. They are shown inline on the
   timeline rows involved, not raised as sync issues.
7. Kept as-is: the live running pill, the timeline with day total, session
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
   journal revisions, the compass and knowledge map, and lifecycle events. Add a
   test that fails when a new user-owned Dexie table is not in the backup.
3. **Versioned with migrators.** Each format version has a migrator to the next.
   Importing an old file runs the same scope migrations as live data (recurring
   memos → activities, hidden group activity → named activity, zero-length
   periods → completion times).
4. **Idempotent merge, through the sync command API.** Operation IDs are derived
   from the backup's row identity, so re-importing is a no-op. Counts are
   imported as the difference between the backup and current state, never as
   "+N from zero". Sessions and events union by ID. Media dedupes by content
   hash. A journal date that already has different text becomes a reviewable
   conflict on Sync issues, never a silent overwrite.
5. **Tests.** Export → clear → import equals the original. Import twice changes
   nothing. Importing into a non-empty account merges without double counts.
6. All copy through i18n in `en` and `pt`.

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
- Groups with archive → restore → permanent delete lifecycle.
- Day navigation: swipe, date picker, configurable day-reset hour.
- Month and holiday banners (§2.8), the world map.
- English and Português (Brasil).
- Sync status, conflict review, pending operations, and the device list.
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
   activity, zero-length periods → completion times, stop writing the entry
   number and stored journal streak. Each migration is idempotent and covered by
   a two-device test.
4. **Rules and lock** — the time-tracking simplification (§2.2), edit-lock
   removal with confirmation and journal revisions (§2.3), derived journal
   streak (§2.4).
5. **Accounts required** (§2.6) — ship the migration release, then delete the
   guest code in the next one.
6. **Opt-ins** — automatic location (§2.7) and daily clip with the new encoder
   (§2.5).
7. **Holidays and banners** (§2.8), then the compilation spike.
