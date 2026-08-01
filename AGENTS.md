# Agent Instructions

These instructions apply to the entire repository.

## Required architecture reading

Before planning or implementing changes to database schemas, Supabase,
synchronization, IndexedDB/Dexie storage, offline behavior, activity or group
lifecycle, historical day rendering, statistics, streaks, backup/restore,
media persistence, account switching, or conflict handling, read:

- [`docs/architecture/temporal-data-sync.md`](docs/architecture/temporal-data-sync.md)

That document is the required architectural direction. In particular:

- Authoritative user history is append-only.
- Definitions are immutable, effective-dated versions.
- Current rows and statistics are rebuildable projections.
- Sync uses idempotent operations, entity revisions, and server sequences.
- Valid concurrent changes are never silently discarded.
- Every unresolved conflict or unsynced-data problem has an in-app review and
  recovery path.
- Historical screens and statistics use the definition effective on the
  requested date, not the latest definition.

Do not introduce current-row-only historical behavior, client-clock
last-write-wins conflict resolution, ordinary hard deletion of accepted
history, or background conflict handling that users cannot inspect.

When a requested change contradicts the architecture document, call out the
conflict before implementation and update the decision record deliberately if
the product direction has changed.

## Existing scoped rules

Also follow applicable rules in `.cursor/rules/`, including the Supabase
migration workflow and shared UI interaction-state guidance.
