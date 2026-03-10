# components/activities

**Groups, activities, timelines, archive.**

## Purpose

Activity groups, activity CRUD, group pages, session timelines, archived items.

## Structure

```
activities/
├── hooks/
│   ├── use-group-activities-data.ts
│   ├── use-group-activity-tracking.ts
│   └── use-archived-items.ts
├── group-activities-content.tsx
├── group-activities-list.tsx
├── group-activities-timeline.tsx
├── group-activities-header.tsx
├── activity-form-fields.tsx
├── activity-form-page.tsx
├── group-form-fields.tsx
├── archive-activity-dialog.tsx
├── delete-confirm-dialog.tsx
├── session-details-content.tsx
├── archived-activities-list.tsx
├── archived-groups-list.tsx
└── ...
```

## Hooks

- **`use-group-activities-data`** — Loads activities for a group. Used by `group-activities-content`.
- **`use-group-activity-tracking`** — Wraps activity tracking for group page.
- **`use-group-activity-page`** — Loads group + activity by route params. Used by `edit-activity.tsx`.
- **`use-session-details`** — Loads session data, handles save/delete. Used by `session-details-content.tsx`.
- **`use-archived-items`** — Loads archived groups/activities, unarchive handlers.

## Conventions

- Use `isActiveActivity`, `isActiveGroup`, `isScheduledRoutine` from `@/lib/activity-utils`.
- Use `getGroupName`, `getGroupColor` for group lookups.
- Use `FormPageLayout` for form pages.
- Use `ArchiveActivityDialog`, `DeleteConfirmDialog` for dialogs.
