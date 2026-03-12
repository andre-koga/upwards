# OkHabit — Agent Guide

Context for AI agents working on this codebase. See also per-folder `CONTEXT.md` files and `.cursor/rules/`.

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
├── pages/           # Route components (thin wrappers)
├── hooks/           # Page-level hooks (route params, page data)
├── components/
│   ├── tasks/      # Today page, daily tasks, journal
│   │   └── hooks/  # Task/journal-specific hooks
│   ├── activities/ # Groups, activities, timelines
│   │   └── hooks/  # Activity/group-specific hooks
│   ├── settings/   # Auth, backup, sync, appearance
│   ├── layout/     # Shared layout (nav, theme)
│   └── ui/         # Shared UI primitives
└── lib/            # DB, sync, utilities
```

---

## Hooks Placement (Intentional)

We use **multiple hooks folders** on purpose:

| Location | Purpose | When to add here |
|----------|---------|------------------|
| `src/hooks/` | **Page-level** — route params, page data loading, redirects | Hooks used by multiple pages or tied to routing |
| `components/tasks/hooks/` | **Task/journal** — daily entry, journal, streaks, location | Hooks for the Today page and task list |
| `components/activities/hooks/` | **Activity/group** — group activities, archive, tracking | Hooks for group/activity pages |
| `lib/use-auth.ts` | **Global** — auth state | Shared across settings, sync, etc. |
| `components/settings/use-data-backup.ts` | **Feature** — backup logic | Colocated with the feature that uses it |

**Rule:** Put hooks in the folder of the feature they serve. Only use `src/hooks/` for cross-page or routing concerns.

---

## Conventions

### Data & State

- **Local-first:** Dexie is the source of truth. Supabase syncs in the background.
- **Types:** `lib/db/types.ts` defines core types. Re-export from there when needed.
- **Date strings:** Use `toDateStr` from `@/lib/db` or `toDateString` from `@/lib/date-utils` for `YYYY-MM-DD`.

### Components

- Pages are thin; they delegate to content components in `components/`.
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

---

## Per-Folder Context

Each major folder has a `CONTEXT.md` describing its role and conventions. Read them when working in that area.
