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
- Archive and delete are lifecycle timestamps (`archived_at`, `deleted_at`) on
  the current row, with an in-app restore/delete path. Past days before the
  timestamp still show the item.
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

Before planning or implementing any change to frontend code, visual design,
styling, layout, copy, component structure, or page-level information
architecture, read:

- [`docs/architecture/design-and-branding.md`](docs/architecture/design-and-branding.md)

That document is the binding design manifesto. In particular:

- Reflective content uses the editorial register (serif, spacious, soft radii);
  operational content uses the instrument register (mono `tabular-nums`, dense
  rows, hairline rules). The contrast between them is the brand.
- The AI gradient is rationed: shared tokens only, documented intensity tiers,
  at most one full-bleed AI surface per screen.
- Every AI surface names its evidence, offers an action, allows override, and
  handles missing-key/offline/error states. The app works with no API key.
- Statistics must be paired with an interpretation and an action.
- Use palette tokens, never raw hexes; work in light and dark (System/Light/Dark
  is the only appearance choice).
- Journal and Memories are one record distinguished by date precision.
- Feature coverage is mandatory: silently dropping a kept feature (counters,
  never-habits, check-only activities, streaks, break days, memos, time
  tracking, the sessions timeline, places, groups lifecycle, day navigation,
  i18n, sync conflict review, backup) is a regression, not a simplification.

Before adding, removing, or reshaping a user-facing feature, read:

- [`docs/architecture/product-scope.md`](docs/architecture/product-scope.md)

It records what the product keeps, what was reshaped (recurring memos became
check-only activities, the edit lock became confirm + revisions, video became an
opt-in daily clip, accounts became required, days end at midnight with sessions
apportioned on read, one baseline local schema), and what was deliberately
removed.
Do not reintroduce a removed feature without updating that document first.

Do not introduce solid saturated brand-color content cards, pastel placeholder
blocks, disconnected floating lists, frosted glass on content cards, or a fixed
phone-width frame on new surfaces.

## Existing scoped rules

Also follow applicable rules in `.cursor/rules/`, including the Supabase
migration workflow and shared UI interaction-state guidance.
