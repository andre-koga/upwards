# Temporal Data and Sync Architecture

Status: **Required direction** — updated 2026-08-26

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
   They may be rebuilt from facts plus the current definition. They are never
   synced.
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

1. **Additive unions; same-row edits need review.** New sessions, memos, status
   events, and count deltas merge by stable IDs. Concurrent edits to the same
   current-state row never silently last-write-wins.
2. **Push before pull.** Realtime wakes, focus, and timer sync all push pending
   local work before applying remote changes.
3. **No local wipe without confirmed server ack.** Sign-out, account switch, and
   guest `use_cloud` must not delete unpushed work without an explicit discard.
4. **Conflicts stay open until resolved.** Dismissing an issue must apply an
   explicit user choice or re-enqueue local state — never just hide the problem.
5. **Tombstones are intentional deletes only.** `deleted_at` syncs when the user
   explicitly archived or deleted; missing remote fields are not treated as
   deletion.
6. **Advance the ops pull cursor only from pulled operations.** A device's own
   push can receive a higher `server_sequence` than ops it has not pulled yet.
   Saving that as `lastAppliedSequence` skips remote ops.
7. **Untimed completion pills are derived from the count.** They are not synced
   `activity_periods` rows. If the day's count is below target, the timeline
   does not show an untimed pill. Timed sessions (duration > 0) remain facts.

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
  send the full current row (name, routine, target, group, order, archive).
- `journal_entry` — **one per user per date**. Natural key
  `(user_id, entry_date)`. Devices get-or-create that row; they never mint a
  second UUID for the same day.
- `one_time_task`, `recurring_memo` — keyed by entity UUID.
- Timed `activity_period` rows — real sessions with a duration. Keyed by
  period UUID.

Local Dexie tables may still contain leftover `activity_definition_versions`
and `group_definition_versions` rows from earlier builds. Those tables are
legacy. New product code must not append versions or resolve historical days
through them. The server no longer writes those tables.

### 2. Immutable domain events and daily facts

Actions and facts that accumulate over time remain recorded:

- Activity count incremented or decremented (`count.delta`)
- Activity paused or resumed for a day
- Break day enabled or disabled
- Timed session started, stopped, or tombstoned (optional 200-character note
  lives on the period row)
- One-time task completed or reopened
- Habit or group archived or restored
- Habit or group deleted
- Journal content changed
- Attachment added or removed

Every sync operation still has a globally unique `operation_id`. Prefer
semantic count/pause/break operations so independent offline additions merge.

Checking a habit is **only** `count.delta`. It is not a daily-entry row upsert
and not an untimed period upsert.

### 3. Disposable local projections (never synced)

These are rebuilt from facts plus the current definition:

- `daily_entries.task_counts`, `paused_task_ids`, `is_break_day` — fold of
  semantic ops. The daily-entry row is a local cache; it is not LWW-synced.
- Untimed completion pills — derived when `count >= target` for that day.
- `activity_streaks` — rebuilt locally.
- `current_activity_id` — derived from an open timed period (`end_time` null).

Updating a projection is not a history violation.

## Identity

| Entity | Key | Create rule |
|--------|-----|-------------|
| Journal | `(user_id, entry_date)` | Deterministic UUID from user + date; get-or-create. Server upserts on the natural key. |
| Daily entry | `(user_id, date)` | Same. Shell rows may be created locally as a projection; counts still arrive via ops. |
| Untimed completion | none | Do not insert an `activity_periods` row. |
| Timed session | period UUID | Union by id; tombstone is explicit. |
| Habit / group | UUID | Stable from first create. |

Guest (unsigned) devices use `guest:{device_id}` in place of `user_id` so
local IDs stay stable until sign-in.

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

Existing devices cut over once: repair natural IDs, enqueue each unsynced
current-state row as a `projection.upsert` (skipping ids already in the
pending queue), submit those ops in bounded batches, then snapshot. That
enqueue is one-shot. Repeating it every cycle mints new `operation_id`s for
the same rows and grows the Waiting to sync list without bound. Duplicate
pending `projection.upsert`s for the same entity are collapsed to the newest
row before submit. Submit applies each op in its own subtransaction so one
foreign-key or cast error cannot abort the rest of the batch. Timed period
upserts create a `daily_entries` shell when the parent row is missing.

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
| Archive / delete lifecycle events    | Union using effective-at and server ordering                 |
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

## Adding a synced field (required checklist)

Before storing a new column or entity, classify it:

- **Fact** (merge by `operation_id` / union) — count delta, timed session,
  lifecycle event.
- **Current-state** (OCC `base_revision`; conflict is reviewable) — habit row,
  journal by date.
- **Local projection** (rebuild; never an op) — streaks, untimed pills, folded
  `task_counts`.

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

Normal deletion appends a tombstone/lifecycle event. The entity disappears
from current views but remains reconstructable on earlier dates.

Permanent erasure is a separate, explicit operation for privacy and account
deletion.

Large media remains in object storage. History stores attachment metadata and
content hashes rather than binary data in the event log.

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
- Do not sync `activity_streaks`.

Leftover local version tables may remain until a dedicated cleanup. They must
not drive new UI, scoring, or RPC writes.

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

## Rules for AI agents and contributors

Before changing related infrastructure:

1. Read this entire document.
2. Identify whether each changed table is a current definition, a recorded
   fact, a lifecycle event, or a disposable cache.
3. Do not add effective-dated definition versions or apply-from UI.
4. Do not hard-delete accepted history during ordinary product operations.
5. Do not implement a conflict policy that lacks an in-app review path.
6. Do not add last-write-wins table sync or a second incremental protocol.
7. Route new mutations through `mutateSynced`. Classify the field first.
8. Include offline, retry, and archive/unarchive coverage proportional to
   the change.

If a proposed change conflicts with these invariants, update this architecture
decision explicitly and explain the tradeoff before implementing it.
