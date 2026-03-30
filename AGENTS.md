# OkHabit — Agent Guide

Context for AI agents working on this codebase. Cursor rules: `.cursor/rules/supabase-migrations.mdc` (migration filenames).

---

## Stack

- **React 19** + **React Router 7** + **TypeScript**
- **Vite** (build), **Tailwind** (styles), **Radix UI** (primitives)
- **Dexie** (IndexedDB, local-first)
- **Supabase** (optional sync)

Path alias: `@/` → `app/src/`

---

## Supabase (Local + Cloud)

- **Local dev:** `supabase/` at project root. Run `pnpm supabase:start` (or `supabase start`).
- **Migrations:** `supabase/migrations/` — source of truth for schema. Use `supabase migration new <name>` for changes.
- **Cloud sync:** `supabase link` then `supabase db push` to deploy. See `supabase/README.md`.

---

## Folder Structure

```
app/src/
├── pages/           # Route screens (composition, page-specific wiring)
│   └── hooks/      # Route-only orchestrators (e.g. one screen’s data graph)
├── hooks/           # Cross-page hooks (route params, shared page data)
├── components/
│   ├── tasks/      # Today widgets: daily tasks, journal UI, dialogs
│   │   └── hooks/  # Task/journal-specific hooks
│   ├── activities/ # Groups, activities, timelines, archive
│   │   └── hooks/  # Activity/group-specific hooks
│   ├── settings/   # Settings cards, auth, backup, sync UI
│   ├── layout/     # Shared layout (nav, theme)
│   └── ui/         # Shared UI primitives
└── lib/            # DB, sync, utilities
```

---

## Hooks Placement (Intentional)

We use **multiple hooks folders** on purpose:

| Location | Purpose | When to add here |
|----------|---------|------------------|
| `pages/hooks/` | **Route orchestration** — composes feature hooks for a single route | Only used by one page under `pages/` (e.g. `useTodayPage`) |
| `src/hooks/` | **Cross-page** — route params, page data loading, redirects | Hooks used by multiple pages or shared routing logic |
| `components/tasks/hooks/` | **Task/journal** — daily entry, journal, streaks, location | Hooks for the Today task list and journal widgets |
| `components/activities/hooks/` | **Activity/group** — group activities, archive, tracking | Hooks for group/activity pages |
| `lib/use-auth.ts` | **Global** — auth state | Shared across settings, sync, etc. |
| `components/settings/use-data-backup.ts` | **Feature** — backup logic | Colocated with the feature that uses it |

**Rule:** Prefer `components/<feature>/hooks/` for feature logic. Use `pages/hooks/` when a **single route** needs a thin orchestration layer over those hooks. Use `src/hooks/` only for hooks shared across **multiple routes**.

---

## Conventions

### Data & State

- **Local-first:** Dexie is the source of truth. Supabase syncs in the background.
- **Types:** `lib/db/types.ts` defines core types. Re-export from there when needed.
- **Date strings:** Use `toDateStr` from `@/lib/db` or `toDateString` from `@/lib/date-utils` for `YYYY-MM-DD`.

### Pages and components

- **`pages/`** owns each **route screen**: layout, data wiring, and UI that is specific to that URL. It is normal for a page file to contain substantial JSX.
- **`components/`** holds reusable pieces: shared primitives (`ui/`), cross-route widgets, and **extracted** chunks when a page would become too large or a widget is reused.
- Use `cn()` from `@/lib/utils` for class merging.
- Shared form layout: `FormPageLayout` from `@/components/ui/form-page-layout`.

### Utilities

- **Date:** `lib/date-utils.ts`
- **Color:** `lib/color-utils.ts` (includes `getContrastColor`, `DEFAULT_GROUP_COLOR`)
- **Error:** `lib/error-utils.ts` (`getErrorMessage`, `logError`, `ERROR_MESSAGES`)
- **Activity/group:** `lib/activity-utils.ts` (predicates, sort, group lookup)

### Post-Edit Checks

After code changes, run from `app/`:

```bash
pnpm run lint && pnpm run ts && pnpm run format
```

