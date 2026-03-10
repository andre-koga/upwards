# components/settings

**Auth, backup, sync, appearance.**

## Purpose

Settings page, auth card, backup, sync status, theme.

## Structure

```
settings/
├── settings-page-content.tsx
├── auth-card.tsx
├── auth-popup.tsx
├── sync-status.tsx
├── sync-status-pill.tsx
├── backup-card.tsx
├── use-data-backup.ts    # Colocated with backup feature
└── ...
```

## Hooks

- **`use-data-backup`** — Export/import backup. Colocated here (not in a hooks folder) because it's only used by this feature.

## Conventions

- Auth: `useAuth` from `@/lib/use-auth`.
- Sync: `syncEngine` from `@/lib/sync`.
- Use `getErrorMessage`, `logError`, `ERROR_MESSAGES` from `@/lib/error-utils`.
