# Temporal Data and Sync Architecture

Status: **Required direction** — updated 2026-10-01

## Scope update (2026-10-01)

[`product-scope.md`](product-scope.md) removed or reshaped several features. The
data-model consequences recorded below are: accounts are required (no guest
identity), recurring memos migrate to check-only activities (`tracks_time`),
the hidden group-default activity becomes an ordinary activity, days always end
at local midnight (no configurable reset hour) and sessions that cross midnight
are stored whole and apportioned to each day at read time, the 7-day edit lock
is replaced by a
confirmation plus append-only journal revisions, the journal streak is derived
instead of stored, per-day pause is historical-only, and backup import is an
idempotent merge through the operation log.

The same update makes four deliberate departures from earlier rules in this
document ([`product-scope.md`](product-scope.md) §2.10 has the reasoning):

1. **Lifecycle is current state, not an event log.** Archive and delete become
   `archived_at` / `deleted_at` timestamps on the activity and group rows,
   replacing the append-only status-event tables. Past days use the current
   timestamps, consistent with the 2026-08-21 decision that past days use the
   current definition. Accepted cost: archive → restore leaves no record of
   the archived interval. Delete is still a tombstone, never a hard delete.
2. **Sessions do not reference daily entries.** Day membership comes from
   `start_time`/`end_time`. The server no longer creates daily-entry shells
   for sessions.
3. **One baseline local schema.** The Dexie upgrade chain and the one-time
   cutover/repair code are replaced by a baseline schema. Pre-baseline devices
   save local rows to a recovery bundle, re-bootstrap from the snapshot, and
   re-import the bundle through the idempotent backup import.
4. **Simpler conflict resolution.** Definition and memo conflicts resolve as
   whole-row "keep this device's / keep the other". Journal conflicts offer
   keep mine / keep theirs / keep both. Per-field merging is removed, but
   every conflict is still reviewed in the app.

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
  recorded per calendar day (local midnight to midnight).
- Archive and delete set lifecycle timestamps (`archived_at`, `deleted_at`)
  rather than erasing, so a habit or group stays visible on days before it
  left the current list (`created_at ≤ day < archived_at ?? deleted_at`).
- Sync retries stay idempotent. Concurrent journal edits and other true
  conflicts stay visible on the in-app Sync issues page.

## Protocol decision (2026-08-26)

Incremental sync is **only** the operation log (`submit_sync_operations` /
`pull_sync_operations`). Last-write-wins table upserts and
`server_updated_at` delta pulls are retired. A snapshot RPC
(`pull_sync_snapshot`) exists for cold start, account switch after a confirmed
empty pending queue, and explicit repair. Snapshot must not run in the same
cycle as incremental pull.

Every user mutation of synced data goes through **one command API**
(`mutateSynced`). Feature code calls named commands. It does not write synced
Dexie tables and does not enqueue operations itself. Remote apply is a
separate path that never enqueues.

This is an intentional departure from the hybrid that ran LWW row sync and the
operation stream in the same `sync()` cycle. That hybrid caused checkmark vs
timeline drift, duplicate journals, and cursor skips that could not be patched
consistently.

## Why this exists

Upwards is local-first. Completions, timers, and journal entries are facts
about a day. Definitions (the current schedule, name, and target) are the
rules used to display and score those facts.

Keeping a second history of every definition edit, plus an effective-from
picker, made the editor harder to understand than the product needed. The
current model matches a conventional app: the row you see is the latest
state, and facts remain on the days they were recorded.

Two transports for the same facts made devices disagree. One log, natural
keys, and derived projections keep devices aligned without silent last-write-wins.

## Core invariants

1. **Definitions are current state.**
   Activity and group name, routine, target, color, order, and the
   `archived_at` / `deleted_at` lifecycle timestamps live on the mutable row.
   Edits replace that row.
2. **Do not rewrite recorded facts.**
   Daily counts, pauses, sessions, and journal content are not deleted when a
   definition changes.
3. **Archive and delete are lifecycle, not silent erasure.**
   Ordinary archive hides the entity from current lists. Past days before
   the archive or delete timestamp still show it. Permanent privacy erasure is
   a separate, explicit operation.
4. **Retries are idempotent.**
   Each sync operation has a stable ID. Replaying it must not apply twice.
5. **Use server ordering for the operation stream, not device clocks.**
   Client timestamps are descriptive metadata.
6. **Derive streaks; never cache them.**
   Streaks are replayed from facts plus the current definition on read. The
   `activity_streaks` cache was removed in schema v29 because it was written on
   every count mutation and read back nowhere.
7. **Make every conflict recoverable in the app.**
   Users must not need SQL or developer tools. Journal conflicts and other
   unresolved concurrent edits stay on Sync issues.
8. **Preserve offline-first behavior.**
   Local changes apply immediately and synchronize later.
9. **One incremental protocol.**
   Devices exchange operations, not row snapshots, except for bootstrap/repair.
10. **One write path.**
    Synced Dexie tables are written by `mutateSynced` (user actions) or
    `applyAcceptedOp` (already-accepted remote ops). Nothing else.

### Multi-device merge safety (2026-08-25, tightened 2026-08-26)

These rules govern cross-device sync and must not be weakened without updating
this document:

1. **Additive unions; same-row edits need review.** New sessions, memos,
   journal revisions, and count deltas merge by stable IDs. Concurrent edits to the same
   current-state row never silently last-write-wins.
2. **Push before pull.** Realtime wakes, focus, and timer sync all push pending
   local work before applying remote changes.
3. **No local wipe without confirmed server ack.** Sign-out, account switch, and
   the one-time legacy guest migration must not delete unpushed work without an
   explicit discard.
4. **Conflicts stay open until resolved.** Dismissing an issue must apply an
   explicit user choice or re-enqueue local state — never just hide the problem.
5. **Tombstones are intentional deletes only.** `deleted_at` syncs when the user
   explicitly archived or deleted; missing remote fields are not treated as
   deletion.
6. **Advance the ops pull cursor only from pulled operations.** A device's own
   push can receive a higher `server_sequence` than ops it has not pulled yet.
   Saving that as `lastAppliedSequence` skips remote ops.
7. **Untimed completion pills are derived from the count.** They are not synced
   `activity_periods` rows. The count delta that reaches a target may carry a
   completion instant, stored with the daily projection for the pill's clock
   display. If the day's count is below target, the timeline does not show an
   untimed pill. Timed sessions (duration > 0) remain facts.

Live updates use Supabase Realtime on `sync_operations` INSERT events. The
client does not filter on `user_id` in `postgres_changes` (RLS already scopes
rows; that column is not the primary key). Own `device_id` events are ignored.
A short debounce then runs the full `sync()` pipeline (push ops, then pull ops).

Do not reintroduce last-write-wins table sync, effective-dated definition
versions, an "apply from" editor control, or dual Dexie hooks that auto-enqueue
projection upserts unless this document is updated again with a new product
tradeoff.

## Data model

The model has three layers that matter for product code.

### 1. Current definition / current-state rows

Optimistic concurrency uses `base_revision` = the row's `updated_at` at edit
time. Stale bases become reviewable conflicts.

- `activities` and `activity_groups` — labels and rules. Projection upserts
  send the full current row (name, routine, target, group, order,
  `tracks_time`, `archived_at`, `deleted_at`). Every activity has a name; the
  hidden group-default activity
  (`name === null`) is migrated to a named activity and must not be recreated.
  `tracks_time = false` activities never own sessions.
- `journal_entry` — **one per user per date**. Natural key
  `(user_id, entry_date)`. Devices get-or-create that row; they never mint a
  second UUID for the same day. Every date is editable; there is no edit
  window. `journal_entry_number`, `journal_completion_streak`,
  `is_journal_complete`, and `journal_completed_at` are no longer written;
  completion is derived from content (emoji, title, and text present).
- `one_time_task` — keyed by entity UUID.
- `recurring_memo` — legacy. Migrated once to check-only activities and no
  longer written.
- Timed `activity_period` rows — real sessions with `end > start` (or open with
  `end` null). Keyed by period UUID. A day is the local calendar date, midnight
  to midnight. Sessions are stored exactly as recorded and never split or
  auto-stopped; a session that crosses midnight belongs to every day it
  overlaps, and each day's share is computed on read (a local projection, never
  synced). Sessions carry no `daily_entry_id`; local queries index
  `start_time` and `end_time`.

The `activity_definition_versions` and `group_definition_versions` Dexie tables
are gone as of schema v28. Nothing had appended to them since effective-dated
definition edits were removed, the server never wrote them, and production
recorded zero definition ops. New product code must not reintroduce definition
versions or resolve historical days through them.

### 2. Immutable domain events and daily facts

Actions and facts that accumulate over time remain recorded:

- Activity count incremented or decremented (`count.delta`)
- Activity paused or resumed for a day — historical only. Clients no longer
  emit pause ops; the server still accepts and replays recorded ones, and past
  pauses keep their effect on streaks.
- Break day enabled or disabled
- Timed session started, stopped, or tombstoned (optional 200-character note
  lives on the period row)
- One-time task completed or reopened
- Journal content changed
- Journal revision recorded — when a confirmed edit to a day older than 7 days
  overwrites title, emoji, text, or media, the previous values are appended as
  a `journal_entry_revisions` row (union by UUID, never edited). Storage
  objects referenced by a revision are not deleted.
- Attachment added or removed

Every sync operation still has a globally unique `operation_id`. Prefer
semantic count/pause/break operations so independent offline additions merge.

Checking a habit is **only** `count.delta`. It is not a daily-entry row upsert
and not an untimed period upsert.

### 3. Disposable local projections (never synced)

These are rebuilt from facts plus the current definition:

- `daily_entries.task_counts`, `paused_task_ids`, `is_break_day`,
  `completion_times` — fold of semantic ops. The daily-entry row is a local
  cache; it is not LWW-synced.
- Untimed completion pills — derived when `count >= target` for that day.
- Streaks — replayed from `daily_entries` on read, never stored. The journal
  completion streak is replayed from completed journal entries the same way.
- The running session — the open timed period (`end_time` null). The
  `current_activity_id` column is no longer written.
- Journal completion — derived from the entry's content.
- Whether an activity or group appears on a past day — derived from
  `created_at`, `archived_at`, and `deleted_at`.

The legacy `activity_status_events` and `group_status_events` tables are not
read or written by the client. Their contents were folded into the lifecycle
timestamps once; the server keeps them read-only.

Updating a projection is not a history violation.

## Identity

| Entity | Key | Create rule |
|--------|-----|-------------|
| Journal | `(user_id, entry_date)` | Deterministic UUID from user + date; get-or-create. Server upserts on the natural key. |
| Daily entry | `(user_id, date)` | Same. Shell rows may be created locally as a projection; counts still arrive via ops. |
| Untimed completion | none | Do not insert an `activity_periods` row. |
| Timed session | period UUID | Union by id; tombstone is explicit. No daily-entry link. |
| Habit / group | UUID | Stable from first create. |

Every user is signed in; there is no guest mode. Rows keyed with
`guest:{device_id}` exist only on devices that predate that decision. They are
rekeyed into the account once, through the legacy handoff on first sign-in,
and that path is then removed. New code must not create guest identities.

## Synchronization protocol

Each installation has a persistent device ID.

```
User action
  → mutateSynced command
  → apply to Dexie immediately
  → enqueue one op with stable operation_id
  → submit_sync_operations
  → server applies merge rules once
  → Realtime INSERT wakes other devices
  → pull_sync_operations since lastAppliedSequence
  → applyAcceptedOp (no enqueue)

New / empty device after pending push succeeds:
  → pull_sync_snapshot
  → set lastAppliedSequence from snapshot
  → then only ops
```

Devices whose local IndexedDB predates the **baseline schema** do not run an
upgrade chain or a natural-ID cutover. Before Dexie opens:

1. Push whatever pending operations still submit.
2. Save every local row (raw IndexedDB read) as a recovery bundle in the
   data-only backup format, and offer it for download.
3. Delete the local database and bootstrap from `pull_sync_snapshot`.
4. Import the bundle through the idempotent backup import, which owns all
   legacy row-shape migrations. Differences become Sync issues.

Devices report their local schema version with their heartbeat. Legacy repair
modules (natural-ID repair, same-date journal dedupe, storage heal, cutover
enqueue) are deleted in the baseline release, after a migration window (see
below). Devices that missed the window take the reset path.

### Release gates and data migrations (2026-10-01)

- **Protocol gate.** Every sync RPC receives the client's `CLIENT_PROTOCOL`
  integer. The server rejects values below `app_config.min_client_protocol`
  with `client_outdated`. The client shows "Update required", keeps its pending
  queue, and reloads into the new build. Raise the minimum whenever operation
  shapes or table semantics change.
- **Server-side migrations with a data epoch.** Data migrations are Supabase SQL
  migrations, idempotent when re-run, that also increment
  `app_config.data_epoch`. A client that sees a newer epoch pushes its pending
  operations and then re-bootstraps from `pull_sync_snapshot`. Clients never
  run their own data conversions.
- **Heartbeat.** `sync_devices` records `client_protocol`,
  `local_schema_version`, and `pending_count`, so a migration window can be
  confirmed in SQL before deploying.
- **Implementation (A1, 2026-10-02).** `app_config` is a singleton row
  readable only by the service role and SQL; the client never reads it
  directly. The public RPCs (`submit_sync_operations(ops, p_client_protocol)`,
  `pull_sync_operations(since_sequence, p_client_protocol)`,
  `pull_sync_snapshot(p_client_protocol)`) check the gate and wrap private
  `*_ungated` bodies, which clients cannot execute. **Edit the `*_ungated`
  functions when changing RPC behavior**; recreating the old one-argument
  signatures would add an ungated overload. Protocol 0 (builds without the
  gate) still receives the legacy bare-array responses while the minimum is 0;
  protocol 1 and above receive `{ results | operations, data_epoch }`, and the
  snapshot carries `data_epoch` alongside its tables.
- **Client handling.** `client_outdated` throws before any pending op is
  marked failed, sets `SyncState.updateRequired`, and stops sync until the app
  reloads into a new build. Older builds cannot tell this rejection from a bad
  op, so the new build requeues ops stored as failed with `client_outdated`
  and resets their attempts. A newer epoch than the stored one triggers push,
  then the unsynced-data check, then a snapshot; the epoch is stored only after
  the snapshot applies, so a blocked re-bootstrap retries on the next sync.
- **Migration windows.** Because the audience is small, migrations ship in a
  coordinated window: every device synced with nothing pending, a backup taken,
  then the client and server deploy together
  ([`product-scope.md`](product-scope.md) §4.1). If the app opens to
  strangers, add a grace period in which the server translates old operation
  shapes instead of rejecting them.

Duplicate pending `projection.upsert`s for the same entity are collapsed to the
newest row before submit. Submit applies each op in its own subtransaction so
one foreign-key or cast error cannot abort the rest of the batch.

Local mutations:

1. Apply immediately via `mutateSynced`.
2. Enter the durable pending-operation queue (exactly one op per user action).
3. Retry until the server acknowledges that operation ID.

Devices pull by monotonic server sequence. The cursor advances only from
pulled operations. Signing out must not erase unacknowledged operations.
Account switching must keep pending data in a recoverable, account-scoped
local area until it is synced, exported, or explicitly discarded.

Ops RPCs are required. There is no LWW fallback. A missing RPC is a durable
sync error.

## Merge rules

| Change                               | Default behavior                                             |
| ------------------------------------ | ------------------------------------------------------------ |
| Independent creations                | Union                                                        |
| Count increments/decrements          | Apply each unique operation once                             |
| Independent timed sessions           | Union; flag impossible overlaps separately                   |
| Archive / restore / delete           | Lifecycle timestamps on the current row; same-row conflict rules apply |
| Current definition row updates       | Latest accepted projection upsert; conflicts stay reviewable |
| Concurrent journal text edits        | Preserve both; never choose silently                         |
| Attachment additions                 | Union by immutable attachment ID/content hash                |

Do not invent a silent client-clock last-write-wins policy for journal text
or for conflicts the user has not reviewed.

The server is the only merge authority. The client applies already-accepted
ops; it does not invent a second merge.

## In-app Sync issues page

Upwards includes a user-facing **Sync issues** page from Settings. It should
display a badge when action is required.

### Sections

1. **Needs your review** — true semantic conflicts that require a choice
   (concurrent journal text, concurrent same-row current-state edits).
2. **Waiting to sync** — durable local operations not yet acknowledged.
3. **Sync errors** — authentication, validation, schema, or transport failures.
   Transient fetch/abort must not create durable cards.
4. **Resolved** — recently resolved issues.
5. **Devices** — known devices and last successful sync.

Not conflicts: two devices incrementing the same habit; independent sessions;
archive + count; snapshot vs local after ack.

Resolving a definition conflict updates the **current** activity or group
row. It does not create an effective-dated historical version.

Resolution shapes:

- **Activities, groups, memos** — both versions shown with differing fields
  highlighted; the user keeps this device's version or the other one, as a
  whole row.
- **Journal** — side-by-side text; keep mine, keep theirs, or keep both. Keep
  both joins the texts with a divider, opens the result for editing, and
  unions photos and places.

Every resolution is an ordinary `mutateSynced` operation. Per-field merge
choices are not offered.

## Adding a synced field (required checklist)

Before storing a new column or entity, classify it:

- **Fact** (merge by `operation_id` / union) — count delta, timed session,
  journal revision.
- **Current-state** (OCC `base_revision`; conflict is reviewable) — habit row
  including its lifecycle timestamps, journal by date.
- **Local projection** (recomputed on read; never an op) — streaks, untimed
  pills, folded `task_counts`.

Then:

1. Put the command in `mutateSynced`. Do not add a second transport.
2. If it is unique by meaning (one per day, one running timer per habit), give
   it a natural key and a unique index. Do not mint a per-device UUID.
3. If it can be computed from facts plus the current definition, do not sync it.
4. Add an integration test: two devices, both mutate, both end with the same
   projection. If it is a same-row text edit, assert a reviewable conflict.

CI fails if feature code writes synced Dexie tables outside the command
module, if LWW table upserts return, or if an untimed (`start_time ===
end_time`) period is stored as a fact.

## Deletion, retention, and media

Normal deletion sets the `deleted_at` tombstone. The entity disappears from
current views but still renders on days before it was deleted, and its facts
are kept.

Permanent erasure is a separate, explicit operation for privacy and account
deletion.

Large media remains in object storage. History stores attachment metadata and
content hashes rather than binary data in the event log.

## Backup and restore

Backup is a user-facing recovery path and must obey the same invariants as
sync (full requirements in [`product-scope.md`](product-scope.md) §2.9):

- Export covers every user-owned table and account setting, plus media files
  unless the user picks "data only". It never includes the AI API key.
- Export and import first push pending operations and pull. Import is
  disabled until the device reaches that clean state.
- Import goes through `mutateSynced` with operation IDs derived from the
  backup's row identity, so importing the same file twice is a no-op.
- Counts are imported as the difference from current state, never as
  "+N from zero". Sessions and events union by ID; media dedupes by content
  hash.
- A date whose journal text differs from the backup becomes a reviewable
  conflict, not an overwrite.
- Old backup formats are migrated forward with the same scope migrations as
  live data.

## Delivery notes

Earlier incremental work added definition versions, an effective-from editor,
op-owned definition fields, and a parallel LWW row sync. Those paths are
retired:

- Do not show apply-from / effective-from UI.
- Do not append definition versions on create, edit, or reorder.
- Do not strip name/routine/target/color from activity and group sync rows.
- Historical streak and day scoring use the current activity row.
- Do not upsert domain tables from the client or pull by `server_updated_at`.
- Do not store untimed checkmarks as `activity_periods`.
- Do not reintroduce a stored streak cache, local or synced.

The legacy local version and streak tables are dropped (schema v28 and v29).
They must not be reintroduced to drive UI, scoring, or RPC writes.

Old clients that still submit untimed period upserts or LWW rows are rejected
or ignored by the server so they cannot reintroduce drift.

## CI, tests, and production schema

Vercel builds the app with `pnpm run build` (`tsc -b && vite build`). It does
**not** run tests and it does **not** apply Postgres migrations.

GitHub Actions owns those two jobs:

1. **PR and `main` CI** (`.github/workflows/ci.yml`)
   - App Vitest (`pnpm test` / `pnpm --dir app test`). These tests mock Dexie
     and Supabase. They are the fast regression net, not a two-device proof.
   - `tsc -b` in `app/`, the same typecheck Vercel uses.
   - Integration tests against **local** `supabase start` + `db reset`
     (`pnpm test:integration`). They call `submit_sync_operations`,
     `pull_sync_operations`, and `pull_sync_snapshot` with a real user JWT
     (not `service_role`).
2. **Merge to `main`** (`.github/workflows/supabase-migrate.yml`)
   - `supabase db push --project-ref --include-all` using repository secrets
     `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`. `--include-all` is
     required when a historical local migration is missing from remote
     history; without it later migrations never apply. The job retries
     transient CLI login-role timeouts. Optional `SUPABASE_DB_PASSWORD`
     avoids the temporary `cli_login_postgres` role.
   - Same-repo PRs that can see those secrets also dry-run `db push --include-all`.
   - Never `db reset` production. Review migration SQL in the PR; CI applies
     whatever lands on `main`.

Local integration loop: `pnpm supabase start && pnpm test:integration`.
Details and secret setup live in [`supabase/README.md`](../../supabase/README.md).

## Required verification

Changes in this area must test at least:

- Editing a habit schedule updates the current row and is what past days use.
- Archiving a habit hides it from For Today and lists it under Archived.
- Unarchive restores it; delete from the archived actions confirms permanently.
- Groups keep the same archive / unarchive / delete drawer pattern.
- An archived or deleted activity still renders on days before its
  timestamp and not after.
- A pre-baseline device recovers through the reset path: pending ops pushed,
  recovery bundle saved, snapshot bootstrapped, bundle re-imported with no
  double counts.
- Two devices increment the same activity without dropping either increment
  (RPC integration test).
- Concurrent journal text edits remain reviewable (RPC integration test;
  conflicts stay on Sync issues in the app).
- Two devices writing the same day's journal produce one row (natural key).
- A request succeeds but its response is lost and then retried (RPC
  integration test: same `operation_id` returns `duplicate`, count stays 1).
- Completing then uncompleting a habit agrees on both devices: count and
  timeline untimed pill match, with no untimed period in the op stream.
- A `sync_operations` INSERT wakes Realtime (integration test).
- Snapshot bootstrap then incremental ops (RPC integration test).
- Sign-out/account switching occurs with pending operations (client unit
  tests; Dexie is mocked).
- Backup round trip: export → clear → import restores the same state; importing
  the same file twice changes nothing; importing into a non-empty account does
  not double counts.
- An outdated `CLIENT_PROTOCOL` is rejected, and pending operations survive
  the update that follows.
- A `data_epoch` bump makes a client push its pending operations and then
  re-bootstrap from the snapshot.
- Every data migration produces the same result when run twice.
- A confirmed edit to an old journal day appends exactly one revision on every
  device, and restoring it is itself a normal reviewable journal edit.
- A session crossing midnight (including across a DST change) appears on both
  days, and the two days' shares sum to its full duration.

## Rules for AI agents and contributors

Before changing related infrastructure:

1. Read this entire document.
2. Identify whether each changed table is a current definition (including
   lifecycle timestamps), a recorded fact, or a disposable cache.
3. Do not add effective-dated definition versions or apply-from UI.
4. Do not hard-delete accepted history during ordinary product operations.
5. Do not implement a conflict policy that lacks an in-app review path.
6. Do not add last-write-wins table sync or a second incremental protocol.
7. Route new mutations through `mutateSynced`. Classify the field first.
8. Include offline, retry, and archive/unarchive coverage proportional to
   the change.

If a proposed change conflicts with these invariants, update this architecture
decision explicitly and explain the tradeoff before implementing it.
