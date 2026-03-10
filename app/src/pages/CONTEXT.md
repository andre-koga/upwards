# pages

**Route components** — thin wrappers that delegate to content components.

## Purpose

Pages handle routing and layout. They should be minimal: import the content component, pass props, and render. Business logic lives in components and hooks.

## Convention

```tsx
// Good: thin wrapper
export default function GroupPage() {
  const { group, loading } = useGroupPage();
  if (loading) return <Loading />;
  if (!group) return null;
  return <GroupActivitiesContent group={group} />;
}

// Avoid: putting logic in the page
```

## Routes (from App.tsx)

- `/` — Today
- `/activities/new` — New group
- `/activities/:groupId` — Group page
- `/activities/:groupId/new` — New activity
- `/activities/:groupId/edit` — Edit group
- `/activities/:groupId/edit/:activityId` — Edit activity
- `/activities/:groupId/sessions/:sessionId` — Session details
- `/activities/stats` — Stats
- `/settings` — Settings
- `/settings/archived` — Archived items
- `/settings/task-order` — Task order
