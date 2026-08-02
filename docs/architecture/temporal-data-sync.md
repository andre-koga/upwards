# Temporal Data and Sync Architecture

Status: **Required direction for future infrastructure work**

This document defines the intended source-of-truth, history, synchronization,
conflict, and statistics model for Upwards. It must be read before changing
database schemas, synchronization, offline storage, activity lifecycle,
historical views, statistics, backup/restore, or related infrastructure.

The implementation may be delivered incrementally, but new work must move
toward this model and must not introduce another current-row-only source of
historical truth.

## Why this exists

Upwards is local-first. The current app stores useful historical facts, such as
daily counts and activity periods, but interprets many of those facts using the
latest mutable activity and group rows.

This rewrites history unintentionally. For example, if an activity changes from
weekends to weekdays, old weekends can become "not scheduled" and old weekdays
can become "missed." Similar problems occur when a completion target, name,
group, archive state, completion state, or deletion state changes.

The current synchronization system also resolves many concurrent edits using
last-write-wins client timestamps. That can silently discard a valid change
from another device.

The replacement model adopts the useful parts of Git's philosophy without
using Git as the datastore:

- Authoritative history consists of immutable objects.
- Current state is a replaceable projection, analogous to a working tree.
- Versions have parents, making concurrent branches detectable.
- Reverting creates a new change instead of erasing history.
- State can be reconstructed for a logical date or an earlier recorded point.

## Core invariants

1. **Do not overwrite authoritative history.**
   User-visible changes create immutable events or definition versions.
2. **Do not silently discard a valid operation.**
   Retries are idempotent, and unresolved concurrent edits are preserved.
3. **Separate facts from the rules used to interpret them.**
   A completion on a date is a fact. The routine and target effective on that
   date determine how that fact is scored.
4. **Resolve historical state as of the requested logical date.**
   Historical views and statistics must not use today's definition by default.
5. **Use server ordering, not device clocks, for synchronization order.**
   Client timestamps are descriptive metadata, not conflict authority.
6. **Treat projections and caches as disposable.**
   They may be updated in place because they can be rebuilt from history.
7. **Make every conflict recoverable in the app.**
   Users must not need SQL, developer tools, or a third-party service.
8. **Preserve offline-first behavior.**
   Local changes apply immediately and synchronize later.
9. **Use one temporal resolver across the product.**
   Daily views, streaks, heatmaps, and all statistics must share the same
   interpretation of a day.
10. **Privacy deletion remains possible.**
    Immutability is a product-history rule, not a reason to deny permanent
    account or personal-data erasure.

## Data model

The model has four layers.

### 1. Immutable definition versions

Mutable definitions include the rules and labels that describe an entity.
Activity definition versions include, at minimum:

- `version_id`
- `activity_id`
- `parent_version_id`
- `effective_from`
- `recorded_at`
- `server_sequence`
- `operation_id`
- `device_id`
- `name`
- `routine`
- `completion_target`
- `group_id`
- `order_index`
- schema version

Group definition versions include historically meaningful fields such as name,
color, and order.

Each edit creates a complete definition snapshot. Full snapshots are preferred
to patches because definitions are small and snapshots make historical reads,
conflict review, and schema migration simpler.

The active definition for logical date `D` is the applicable version with the
latest `effective_from <= D`, resolved according to its version lineage and
server ordering. A projection may cache the latest version for current views.

### 2. Immutable domain events

Actions and facts that accumulate over time are represented as events. Examples:

- Activity count incremented or decremented
- Activity paused or resumed for a day
- Break day enabled or disabled
- Session started or stopped
- One-time task completed or reopened
- Activity retired, restored, deleted, or restored from deletion
- Group archived or restored
- Journal content changed
- Attachment added or removed
- Conflict resolved

Every operation must have a globally unique `operation_id`. Replaying the same
operation must not apply it twice.

Prefer semantic operations over replacing compound values. For example, sync a
count increment instead of replacing the complete `task_counts` map. This lets
independent offline additions merge naturally.

### 3. Current-state projections

Dexie and Postgres may contain mutable projections optimized for application
reads, including current activity definitions, current daily totals, active
timers, journal state, and cached streaks.

These rows are not authoritative history. They must identify the source
sequence or revision from which they were built and must be rebuildable.

Updating or replacing a projection is not a history violation.

### 4. Derived historical projections

A shared temporal resolver computes state for a logical date:

1. Resolve the activity and group definitions effective on the date.
2. Resolve lifecycle state effective on the date.
3. Collect completion, pause, break, session, and other facts for the date.
4. Determine whether the activity was scheduled.
5. Apply the completion target effective on that date.
6. Produce the display and statistical outcome.

Past-day UI, streaks, completion rates, heatmaps, compound scores, activity
statistics, group statistics, and overall statistics must use this resolver.
Derived statistics are caches, not sources of truth.

## Effective time and recorded time

Definitions and lifecycle changes require two notions of time:

- **Effective time:** when the change applies to the user's logical calendar.
- **Recorded time:** when the app/server learned about the change.

An activity edit should default to applying from the current logical day. Where
appropriate, the UI should let the user apply it from another date or from the
activity's beginning.

This distinction supports both:

- "My routine changes beginning today."
- "The schedule entered for June was wrong; correct it from June 1."

Recorded time preserves the audit trail even when effective history is
corrected later.

## Synchronization protocol

Each installation has a persistent device ID. Local mutations:

1. Create an immutable operation with an ID and the base entity revision.
2. Apply immediately to the local projection.
3. Enter a durable local pending-operation queue.
4. Retry until the server acknowledges that exact operation ID.

The server processes operations transactionally:

1. Authenticate the user and validate entity ownership.
2. Deduplicate by operation ID.
3. Lock or compare the affected entity revision.
4. Apply an automatic merge when the domain rule permits it.
5. Otherwise preserve the incoming branch as a conflict.
6. Append the accepted/conflicted operation to the event stream.
7. Update projections.
8. Return the resulting revision and server sequence.

Devices pull by monotonic server sequence, not client `updated_at`. A device
records its last applied sequence and can resume safely after interruption.

Signing out, closing the app, or losing a network response must not erase
unacknowledged operations. Account switching must keep pending data in a
recoverable, account-scoped local area until it is synced, exported, or
explicitly discarded by the user.

## Merge rules

Merge behavior is domain-specific:

| Change                               | Default behavior                                                 |
| ------------------------------------ | ---------------------------------------------------------------- |
| Independent creations                | Union                                                            |
| Count increments/decrements          | Apply each unique operation once                                 |
| Independent sessions                 | Union; flag impossible overlaps separately                       |
| Append-only lifecycle events         | Union using effective and server ordering                        |
| Edits to different definition fields | Automatic field merge when bases match                           |
| Edits to the same definition field   | Preserve both and create a conflict                              |
| Concurrent journal text edits        | Preserve both; never choose silently                             |
| Ordering                             | Stable fractional keys with deterministic operation-ID tie-break |
| Edit concurrent with deletion        | Keep deletion state and preserve the edit for restore/review     |
| Attachment additions                 | Union by immutable attachment ID/content hash                    |

Automatic merging must be deterministic and covered by multi-device tests.

## In-app Issues and Conflicts page

Upwards must include a user-facing page for synchronization issues. Use a
friendly product label such as **Sync issues** or **Review changes**; do not
require users to understand Git terminology.

The page must be reachable from Settings and should display a visible badge or
banner whenever action is required.

### Sections

1. **Needs your review**
   True semantic conflicts that require a choice.
2. **Waiting to sync**
   Durable local operations not yet acknowledged, grouped by device/account.
3. **Sync errors**
   Authentication, validation, schema, storage, or repeated transport failures.
4. **Resolved**
   Recently resolved issues with an audit trail and an undo/restore path when
   possible.
5. **Devices**
   Known devices, last successful sync, pending-operation count, and a way to
   retire a lost device without deleting its accepted history.

### Conflict presentation

Every conflict card should explain:

- What changed, in user language
- Entity and affected logical date/range
- Device/source when known
- Local version
- Other version
- Common ancestor/base version
- Fields that differ
- Consequences for historical days or statistics

Available actions depend on the domain:

- Keep this version
- Keep the other version
- Combine non-conflicting fields
- Edit a merged result
- Keep both, when meaningful
- Apply from a selected effective date
- Restore or reopen a deleted entity
- Defer the decision

Resolving a conflict creates a new immutable resolution version/event whose
parents reference the competing versions. It must not delete either branch.

### Unsynced-device behavior

The UI must distinguish a conflict from an unavailable device:

- An offline device is normal and does not block other devices.
- Its accepted server history remains available.
- Operations that exist only on that device cannot be recovered remotely until
  it reconnects or the user imports an export from it.
- Other devices should show last-seen information, not claim that unknown local
  work is safely backed up.
- Retiring a device prevents future trust/session use but does not delete its
  accepted events.

The page should provide safe recovery actions such as retry, reauthenticate,
export pending operations, inspect details, or explicitly discard a local
operation after a strong warning.

## Historical behavior and statistics

For each activity and date, statistics must answer:

1. Did the activity exist?
2. Was it active and visible?
3. Which definition and group applied?
4. Was it scheduled under that definition?
5. What completion target applied?
6. Was the date paused or a break day?
7. Which completion facts were recorded?
8. What outcome follows from those facts and rules?

Changing a weekend activity to weekdays effective today must not alter any
earlier denominator, outcome, or streak. Changing a target from one to three
must not make earlier completions fail unless the user explicitly applies that
definition retroactively.

Historical grouping and labels should default to the definition that applied at
the time. A separate "organize all history under the current group" product
feature, if desired, must be explicit rather than an accidental side effect.

## Deletion, retention, and media

Normal deletion appends a tombstone/lifecycle event with an effective date.
The entity disappears from current views but remains reconstructable before
that date and restorable afterward.

Permanent erasure is a separate, explicit operation for privacy and account
deletion. It must cover immutable events, versions, projections, exports, and
media according to the product's retention policy.

Large media remains in object storage. History stores immutable attachment
metadata and content hashes rather than placing binary data in the event log.
Offline media needs a durable local upload queue and clear backup status.

## Snapshots, performance, and migrations

Reconstructing state must not require replaying an account's entire history on
every page load. Use indexed effective-date queries, current projections, and
periodic snapshots/checkpoints. Snapshots are disposable accelerators and
record the source server sequence they include.

Schema migrations must preserve old events and versions. Event payloads and
definition snapshots carry a schema version; projection builders must either
up-convert old shapes or retain version-specific readers.

Existing overwritten activity definitions cannot be inferred reliably. Initial
migration can create a baseline version from the current row, but users may
need a repair tool to define older schedule/target periods manually.

## Delivery sequence

1. Add immutable activity/group definition versions.
2. Implement and test one shared temporal resolver.
3. Route historical views and every statistics calculation through it.
4. Add effective-date controls for definition edits.
5. Add durable operation IDs, device identity, and a pending queue.
6. Convert compound mutable facts to semantic append-only operations.
7. Replace timestamp last-write-wins sync with revision/sequence sync.
8. Add conflict persistence and the in-app Issues and Conflicts page.
9. Make current tables explicitly rebuildable projections.
10. Add history browsing, restore, snapshots, and historical repair tools.

### Implementation status (core multi-device path)

| Stage | Status                                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–4   | Done locally (definition versions, resolver, stats consumers, effective-from UI)                                                                                                                        |
| 5     | Done for local device id + pending queue; server device registry/labels deferred                                                                                                                        |
| 6     | Partial: count / pause / break-day / definition ops; journal & sessions still LWW                                                                                                                       |
| 7     | Partial: ops stream is authoritative for those domains when RPCs are applied; LWW continues for other tables and non-op columns. Clients strip op-owned projection fields once ops RPCs are known live. |
| 8     | Done for definition conflicts (compare + keep mine/theirs/combine/defer + apply-from date)                                                                                                              |
| 9–10  | Deferred                                                                                                                                                                                                |

**Required Supabase migrations for multi-device ops:**

- `20260801120000_temporal_definition_versions_and_ops.sql`
- `20260802010000_definition_field_level_merge.sql`

Apply both in the Supabase SQL editor (or CLI) before relying on multi-device conflict/merge behavior. Until they are applied, the client falls back to classic LWW row sync.

Incremental stages may temporarily dual-write, but they must have parity checks
and a rollback path. Do not switch the source of truth without migration and
multi-device verification.

## Required verification

Infrastructure changes in this area must test at least:

- Two offline devices modify different activities on the same day.
- Two devices increment the same activity.
- Two devices edit different fields of one activity definition.
- Two devices edit the same field or journal text.
- One device edits while another deletes.
- Routine and completion-target changes preserve earlier statistics.
- Deleted/retired activities remain correct on earlier dates.
- A request succeeds but its response is lost and then retried.
- Synchronization stops midway and later resumes.
- Device clocks differ substantially.
- Sign-out/account switching occurs with pending operations.
- An offline device remains absent for a long period and later reconnects.
- A user resolves a conflict and can inspect the preserved branches.
- A new device rebuilds from a snapshot plus subsequent events.
- Permanent account erasure removes protected personal history and media.

## Rules for AI agents and contributors

Before changing related infrastructure:

1. Read this entire document.
2. Identify whether each changed table is authoritative history, a projection,
   or a cache.
3. State the effective-time, recorded-time, idempotency, conflict, deletion, and
   migration behavior.
4. Trace all historical and statistics consumers affected by the change.
5. Include offline, retry, account-switch, and multi-device tests.
6. Do not introduce client-clock last-write-wins as a conflict policy.
7. Do not hard-delete accepted history during ordinary product operations.
8. Do not implement a conflict policy that lacks an in-app review/recovery path.

If a proposed change conflicts with these invariants, update this architecture
decision explicitly and explain the tradeoff before implementing it. Do not
silently bypass the model for convenience.
