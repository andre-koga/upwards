<div align="center">

<img src="app/public/icon-192x192.png" alt="Upwards icon" width="64" height="64" />

# Upwards

**A focused, local-first habit and daily activity tracker**

</div>

---

## What the App Is About

Upwards is built to help you stay consistent with daily habits while keeping context around each day.
It combines activity tracking, streaks, session timelines, and lightweight journaling in one place.

---

## Features

### Activity & Group Management

- Create groups to organize habits by life area
- Create activities with flexible routines (daily, weekly, monthly, custom cadence, never-type)
- Archive and restore groups/activities as routines evolve

### Daily Tracking

- Mark recurring activities complete from the daily list
- Keep completed items in-place for stable ordering
- Track one-time tasks alongside recurring habits

### Streaks

- See streak badges directly on activity rows
- Streak colors scale by streak length for quick visual feedback
- Never-type activities track consecutive non-completed days
- Streak values are persisted per day so historical streaks remain stable

### Time Tracking & Session History

- Start/stop sessions per activity with live elapsed time
- Review session history in timeline format
- Open session details from timeline entries
- Manage groups and activities from the Projects drawer (edit by tapping the name)

### Journal & Day Context

- Add a daily title and notes
- Save a day emoji and bookmark important days
- Attach uploaded video and location context to each day

### Navigation & UX

- Navigate across past and future days
- Manage archived groups and activities in a dedicated archive view
- Mobile-friendly interface with theme support

---

## Product Focus

Upwards is designed to make consistency visible, reduce friction in daily tracking, and preserve meaningful day-by-day progress over time.

---

## Architecture

Changes to persistence, offline synchronization, historical views, lifecycle
behavior, or statistics must follow the
[temporal data and sync architecture](docs/architecture/temporal-data-sync.md).
It defines the app's append-only history, effective-dated definitions,
multi-device conflict handling, and in-app recovery requirements.

Changes to shared components, accessibility, navigation, or responsive layouts
must follow the
[UI system and responsive layout architecture](docs/architecture/ui-system-and-responsive-layout.md).
It defines the shadcn/Radix alignment strategy and the adaptive mobile/desktop
experience.

## Testing and schema deploy

| Path | What it does |
|------|----------------|
| Vercel | `pnpm run build` in `app/` (`tsc -b && vite build`). No tests. No SQL. |
| GitHub Actions CI | App Vitest + `tsc -b`, then local Supabase integration tests. |
| Merge to `main` | `supabase db push` to the hosted project (see [supabase/README.md](supabase/README.md)). |

```bash
pnpm test                 # app unit tests
pnpm typecheck            # app tsc -b
pnpm supabase start && pnpm test:integration
```
