# components

**Feature and UI components.**

## Structure

```
components/
├── tasks/       # Today page, daily tasks, journal — see tasks/CONTEXT.md
├── activities/  # Groups, activities, timelines — see activities/CONTEXT.md
├── settings/    # Auth, backup, sync — see settings/CONTEXT.md
├── layout/      # Shared layout (nav, theme)
└── ui/          # Shared UI primitives — see ui/CONTEXT.md
```

## Convention

- Feature components live in their domain folder (`tasks`, `activities`, `settings`).
- Shared UI primitives live in `ui/`.
- Each feature folder may have its own `hooks/` subfolder for feature-specific hooks.
