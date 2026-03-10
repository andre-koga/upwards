# components/tasks

**Today page, daily tasks, journal, one-time tasks.**

## Purpose

Everything related to the main Today view: daily task list, journal (emoji, YouTube, text, location, bookmark), one-time tasks, streaks, activity tracking.

## Structure

```
tasks/
├── hooks/                # Task/journal hooks
│   ├── use-daily-tasks.ts      # Orchestrates daily tasks
│   ├── use-daily-entry.ts      # Daily entry CRUD, task counts
│   ├── use-one-time-tasks.ts   # One-time tasks
│   ├── use-activity-tracking.ts
│   ├── use-journal-entry.ts
│   ├── use-journal-meta.ts
│   └── use-location-detection.ts
├── tasks-page-content.tsx
├── daily-tasks-list.tsx
├── activity-task-item.tsx
├── one-time-task-item.tsx
├── task-checkbox.tsx
├── date-navigator.tsx
├── activity-groups-drawer.tsx
└── ...
```

## Hooks

- **`use-daily-tasks`** — Composes `useDailyEntry`, `useOneTimeTasks`, `useActivityTracking`. Main entry for daily list.
- **`use-journal-entry`** — Journal state, save, load. Used by `tasks-page-content`.
- **`use-journal-meta`** — Entry dates, bookmarked dates for calendar.
- **`use-location-detection`** — Geolocation + reverse geocoding for journal.

## Conventions

- Use `isActiveActivity`, `isActiveGroup`, `sortActivitiesByOrder` from `@/lib/activity-utils`.
- Use `DEFAULT_GROUP_COLOR` from `@/lib/color-utils`.
- Shared form layout: `FormPageLayout` from `@/components/ui/form-page-layout`.
