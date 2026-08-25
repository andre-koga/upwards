# Temporal Data and Sync Architecture

Status: **Required direction** — updated 2026-08-21

This document defines the source-of-truth, history, synchronization, conflict,
and statistics model for Upwards. It must be read before changing database
schemas, synchronization, offline storage, activity lifecycle, historical
views, statistics, backup/restore, or related infrastructure.

## Product decision (2026-08-21)

Upwards stores **the current activity and group definition as a regular row**.
Editing a name, schedule, target, color, or order overwrites that row. There
is no "apply schedule/rules from today" control, and the app does not keep an
ordered definition-version lineage for those fields.

Historical days and streaks interpret recorded facts using **the current
definition**. Changing a weekend habit to weekdays will change how earlier
weekends and weekdays are scored. That is an accepted product tradeoff: a
simpler, predictable editor instead of effective-dated rule history.

This is an intentional departure from the earlier direction that treated
immutable definition versions as the source of historical truth.

What still is **not** current-row-only:

- Daily facts (counts, pauses, break days, sessions, journal content) stay
  recorded per logical day.
- Archive and delete append lifecycle events so a habit or group can remain
  visible on earlier days after it leaves the current list.
- Sync retries stay idempotent. Concurrent journal edits and other true
  conflicts stay visible on the in-app Sync issues page.

## Why this exists

Upwards is local-first. Completions, timers, and journal entries are facts
about a day. Definitions (the current schedule, name, and target) are the
rules used to display and score those facts.

Keeping a second history of every definition edit, plus an effective-from
picker, made the editor harder to understand than the product needed. The
current model matches a conventional app: the row you see is the latest
state, and facts remain on the days they were recorded.

## Core invariants

1. **Definitions are current state.**
   Activity and group name, routine, target, color, order, and archive flags
   live on the mutable row. Edits replace that row.
2. **Do not rewrite recorded facts.**
   Daily counts, pauses, sessions, and journal content are not deleted when a
   definition changes.
3. **Archive and delete are lifecycle, not silent erasure.**
   Ordinary archive hides the entity from current lists. Past days can still
   show it. Permanent privacy erasure is a separate, explicit operation.
4. **Retries are idempotent.**
   Each sync operation has a stable ID. Replaying it must not apply twice.
5. **Use server ordering for the operation stream, not device clocks.**
   Client timestamps are descriptive metadata.
6. **Treat streak caches as disposable.**
   They may be rebuilt from facts plus the current definition.
7. **Make every conflict recoverable in the app.**
   Users must not need SQL or developer tools. Journal conflicts and other
   unresolved concurrent edits stay on Sync issues.
8. **Preserve offline-first behavior.**
   Local changes apply immediately and synchronize later.

Do not reintroduce effective-dated definition versions, an "apply from"
editor control, or operation-order tracking for schedule/rule edits unless
this document is updated again with a new product tradeoff.

## Data model

The model has three layers that matter for product code.

### 1. Current definition rows

`activities` and `activity_groups` are the source of truth for labels and
rules. Projection upserts send the full current row (including name, routine,
target, group, order, and archive).

Local Dexie tables may still contain leftover `activity_definition_versions`
and `group_definition_versions` rows from earlier builds. Those tables are
legacy. New product code must not append versions or resolve historical days
through them.

### 2. Immutable domain events and daily facts

Actions and facts that accumulate over time remain recorded:

- Activity count incremented or decremented
- Activity paused or resumed for a day
- Break day enabled or disabled
- Session started or stopped, or a habit checked complete without a time span
  (optional 200-character note lives on the period row). Counts remain the
  streak fact; a zero-duration period is only so the timeline and notes have
  a row. Keep one untimed completion per activity per day; extra copies are
  tombstoned.
- One-time task completed or reopened
- Habit or group archived or restored
- Habit or group deleted
- Journal content changed
- Attachment added or removed

Every sync operation still has a globally unique `operation_id`. Prefer
semantic count/pause/break operations so independent offline additions merge.

### 3. Disposable projections

Dexie and Postgres may cache current daily totals, timers, journal state, and
streaks. These rows can be rebuilt. Updating a projection is not a history
violation.

## Historical behavior and statistics

For each activity and date, statistics answer:

1. Did the activity exist and was it visible that day (lifecycle events)?
2. Is it scheduled under the **current** routine?
3. What completion target does the **current** row use?
4. Was the date paused or a break day?
5. Which completion facts were recorded?
6. What outcome follows from those facts and the current rules?

Archive and delete still use effective-at lifecycle events so that:

- Archiving today hides the habit from tomorrow's For Today list.
- Earlier days can still show the habit with a read-only archived/deleted
  explanation.

They do **not** restore an older schedule. The current routine and target
apply on every visible day.

## Habits and groups

Habits (activities) and groups share the same archive pattern:

- Archive from the edit screen.
- Current lists hide archived items.
- The projects drawer shows a compact **Archived** section at the bottom.
- Opening an archived item offers **Unarchive** or **Delete**.

Delete from that archived-item flow is the permanent product deletion (soft
tombstone). It is not the same as archive.

## Synchronization protocol

Each installation has a persistent device ID. Local mutations:

1. Apply immediately to the local current row or fact table.
2. Enter a durable pending-operation queue (projection upserts for current
   rows; semantic ops for counts/pause/break).
3. Retry until the server acknowledges that operation ID.

Devices pull by monotonic server sequence when ops RPCs are available.
Signing out must not erase unacknowledged operations. Account switching must
keep pending data in a recoverable, account-scoped local area until it is
synced, exported, or explicitly discarded.

## Merge rules

| Change                               | Default behavior                                             |
| ------------------------------------ | ------------------------------------------------------------ |
| Independent creations                | Union                                                        |
| Count increments/decrements          | Apply each unique operation once                             |
| Independent sessions                 | Union; flag impossible overlaps separately                   |
| Archive / delete lifecycle events    | Union using effective-at and server ordering                 |
| Current definition row updates       | Latest accepted projection upsert; conflicts stay reviewable |
| Concurrent journal text edits        | Preserve both; never choose silently                         |
| Attachment additions                 | Union by immutable attachment ID/content hash                |

Do not invent a silent client-clock last-write-wins policy for journal text
or for conflicts the user has not reviewed.

## In-app Sync issues page

Upwards includes a user-facing **Sync issues** page from Settings. It should
display a badge when action is required.

### Sections

1. **Needs your review** — true semantic conflicts that require a choice.
2. **Waiting to sync** — durable local operations not yet acknowledged.
3. **Sync errors** — authentication, validation, schema, or transport failures.
4. **Resolved** — recently resolved issues.
5. **Devices** — known devices and last successful sync.

Resolving a definition conflict updates the **current** activity or group
row. It does not create an effective-dated historical version.

## Deletion, retention, and media

Normal deletion appends a tombstone/lifecycle event. The entity disappears
from current views but remains reconstructable on earlier dates.

Permanent erasure is a separate, explicit operation for privacy and account
deletion.

Large media remains in object storage. History stores attachment metadata and
content hashes rather than binary data in the event log.

## Delivery notes

Earlier incremental work added definition versions, an effective-from editor,
and op-owned definition fields. That path is retired for product behavior:

- Do not show apply-from / effective-from UI.
- Do not append definition versions on create, edit, or reorder.
- Do not strip name/routine/target/color from activity and group sync rows.
- Historical streak and day scoring use the current activity row.

Leftover local version tables and server definition-op handlers may remain
until a dedicated cleanup. They must not drive new UI or scoring.

## Required verification

Changes in this area must test at least:

- Editing a habit schedule updates the current row and is what past days use.
- Archiving a habit hides it from For Today and lists it under Archived.
- Unarchive restores it; delete from the archived actions confirms permanently.
- Groups keep the same archive / unarchive / delete drawer pattern.
- Two devices increment the same activity without dropping either increment.
- Concurrent journal text edits remain reviewable.
- A request succeeds but its response is lost and then retried.
- Sign-out/account switching occurs with pending operations.

## Rules for AI agents and contributors

Before changing related infrastructure:

1. Read this entire document.
2. Identify whether each changed table is a current definition, a recorded
   fact, a lifecycle event, or a disposable cache.
3. Do not add effective-dated definition versions or apply-from UI.
4. Do not hard-delete accepted history during ordinary product operations.
5. Do not implement a conflict policy that lacks an in-app review path.
6. Include offline, retry, and archive/unarchive coverage proportional to
   the change.

If a proposed change conflicts with these invariants, update this architecture
decision explicitly and explain the tradeoff before implementing it.
