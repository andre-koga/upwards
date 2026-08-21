# Agent Instructions

These instructions apply to the entire repository.

## Required architecture reading

Before planning or implementing changes to database schemas, Supabase,
synchronization, IndexedDB/Dexie storage, offline behavior, activity or group
lifecycle, historical day rendering, statistics, streaks, backup/restore,
media persistence, account switching, or conflict handling, read:

- [`docs/architecture/temporal-data-sync.md`](docs/architecture/temporal-data-sync.md)

That document is the required architectural direction. In particular:

- Activity and group definitions are current-state rows. Edits overwrite the
  latest name, schedule, target, and related fields.
- Historical days and streaks use the current definition, not an effective-dated
  version history.
- Daily facts (counts, sessions, journal) remain recorded per day.
- Archive and delete are lifecycle events with an in-app restore/delete path.
- Sync uses idempotent operations. Unresolved conflicts stay reviewable in the
  app.

Do not reintroduce apply-from / effective-from definition UI, definition-version
lineage for schedule edits, ordinary hard deletion of accepted history, or
background conflict handling that users cannot inspect.

When a requested change contradicts the architecture document, call out the
conflict before implementation and update the decision record deliberately if
the product direction has changed.

Before planning or implementing changes to shared UI primitives, forms,
dialogs, drawers, navigation, responsive layout, accessibility behavior, or
page-level information architecture, read:

- [`docs/architecture/ui-system-and-responsive-layout.md`](docs/architecture/ui-system-and-responsive-layout.md)

That document establishes shadcn/Radix as the baseline for generic accessible
behavior while preserving Upwards-specific components and mobile behavior. It
also requires a real adaptive desktop shell rather than a wider or centered
phone layout.

## Existing scoped rules

Also follow applicable rules in `.cursor/rules/`, including the Supabase
migration workflow and shared UI interaction-state guidance.
