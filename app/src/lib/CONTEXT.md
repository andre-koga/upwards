# lib

**Core logic, DB, sync, utilities.**

## Purpose

Single source for shared logic. No UI. Used by components and hooks across the app.

## Structure

```
lib/
├── db/               # Dexie schema, types, helpers
│   ├── index.ts
│   ├── types.ts
│   └── daily-entry.ts
├── sync/             # Supabase sync
│   ├── index.ts           # SyncEngine, auto-sync, mutation hooks
│   ├── sync-constants.ts  # Table lists, timing
│   ├── sync-push.ts       # Push / upsert pipeline
│   ├── sync-pull.ts       # Pull / bulkPut pipeline
│   ├── sanitizers.ts
│   ├── sync-transformers.ts
│   └── sync-storage.ts
├── use-auth.ts       # Auth hook (shared)
├── activity-utils.ts
├── activity-formatters.ts
├── activity-validation.ts
├── activity-periods.ts
├── date-utils.ts
├── journal-utils.ts
├── journal-video-compression.ts  # Browser-side compress before upload
├── journal-video-storage.ts      # Supabase Storage upload/delete
├── streak-utils.ts
├── color-utils.ts
├── error-utils.ts
├── form-styles.ts
├── habit-quotes.ts   # Today page motivational quotes
├── utils.ts          # cn()
├── emoji-utils.ts
└── hidden-group-activity.ts
```

## Key Modules

| Module           | Purpose                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `db/`            | Dexie schema, `toDateStr`, `newId`, `todayStr`, types                          |
| `sync/`          | Sync engine, push/pull, sanitizers                                             |
| `date-utils`     | `toDateString`, `shiftDate`, `startOfDay`, `addDays`                           |
| `activity-utils` | `isActiveActivity`, `isActiveGroup`, `sortActivitiesByOrder`, `getGroup`, etc. |
| `color-utils`    | `getContrastColor`, `DEFAULT_GROUP_COLOR`, `hexToHsl`, `hslToHex`              |
| `error-utils`    | `getErrorMessage`, `logError`, `ERROR_MESSAGES`                                |

## Conventions

- No React components in `lib/`. Hooks only if they're truly global (e.g. `use-auth`).
- Use `@/lib/` for imports. Avoid circular dependencies.
- Keep utilities pure; DB access goes through `db` from `@/lib/db`.
