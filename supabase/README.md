# Upwards Supabase Local Development

Local Supabase stack for development, with migrations kept in sync with the cloud project.

## Prerequisites

- **Docker** (or compatible: Colima, OrbStack, Podman, Rancher Desktop)
- If you run multiple Supabase projects locally, make sure ports in `supabase/config.toml` don’t collide.
- **Supabase CLI** — project has it as dev dependency. Use `pnpm supabase <cmd>` (e.g. `pnpm supabase start`, `pnpm supabase login`). Alternatively: `brew install supabase/tap/supabase`

## Quick Start

```bash
# From project root
pnpm supabase start
```

This starts the local stack and applies migrations. You'll get:

- **API URL:** http://localhost:65421
- **Studio:** http://localhost:65423
- **anon key** and **service_role key** in the output

## Local Development

1. **Start local Supabase:**
   ```bash
   pnpm supabase start
   ```

2. **Copy `app/.env.example` to `app/.env.local`** and add the anon key from `supabase start` output:
   ```env
   VITE_SUPABASE_URL=http://localhost:65421
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from supabase start>
   ```

3. **Run the app:**
   ```bash
   cd app && pnpm dev
   ```

4. **Stop when done:**
   ```bash
   pnpm supabase stop
   ```

## Test users (local seed)

After `pnpm supabase db reset` (or first `start` with seed), a local account is available:

| Email | Password |
|-------|----------|
| `test@test.com` | `password` |

The seed fills that account with about 45 days of history (dates relative to reset day):

- **Projects:** Health, Work, Home, plus an archived Old project
- **Habits:** daily, weekday, weekend, anytime, never, custom, monthly, a group-default timer, a completed habit, and one routine change (Deep work weekdays → daily)
- **Today:** left incomplete so there is still work to do; older days mix wins, misses, two break days, and a gym pause
- **Timers:** closed activity periods on recent days
- **Memos:** pinned, due today, open, completed, archived, plus daily/weekly recurring presets
- **Journal:** about 15 entries (text/emoji/bookmarks/locations; no photos or videos)

Streaks are not stored as seed rows. Today recomputes them from the daily entries.

The app is local-first. After a reset, **sign out** (or use a fresh browser profile) then sign in as `test@test.com` so IndexedDB is empty and pull hydrates this seed. Resetting Postgres while the same browser still holds old Dexie data will merge leftover local rows.

Seed files: [`seed.sql`](seed.sql) (auth + profile) then [`seeds/test-account.sql`](seeds/test-account.sql).

## Tests

App unit tests live in `app/` and mock Dexie/Supabase:

```bash
pnpm test                 # from repo root, or: cd app && pnpm test
```

Sync RPC and Realtime integration tests talk to the **local** stack with a
real authenticated user (never `service_role` for the RPCs under test):

```bash
pnpm supabase start
pnpm test:integration
```

`pnpm test:integration` will also read credentials from `supabase status` if
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are unset.
GitHub Actions runs the same command after `supabase start` and `db reset`.

## Migrations

### Creating a new migration

```bash
pnpm supabase migration new <descriptive_name>
```

Edit the new file in `supabase/migrations/`, then:

```bash
pnpm supabase db reset   # Apply locally
```

### Pushing to cloud

**Production schema applies on merge to `main`.** The workflow
[`.github/workflows/supabase-migrate.yml`](../.github/workflows/supabase-migrate.yml)
runs `supabase db push --project-ref --include-all`. `--include-all` is
required when a historical local migration was never recorded on the remote
(out-of-order history); without it later migrations never apply. Vercel never
touches Postgres.

Add these GitHub Actions secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|--------|
| `SUPABASE_ACCESS_TOKEN` | Personal or CI access token from [Supabase access tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF` | Project id from [General settings](https://app.supabase.com/project/_/settings/general) |

The token needs permission to link the project and push migrations (a personal
access token from Account → Access Tokens with project access, not a scoped
token that cannot call the Management API).
adding secrets, either merge to `main` or run **Supabase migrate** →
**Run workflow**. The first push no-ops if remote history already matches git,
or applies any migrations that are not on the hosted project yet.

Do **not** run `pnpm supabase db reset` against the linked cloud project.

Same-repo pull requests also dry-run `db push` when those secrets exist. Fork
PRs cannot use production secrets; local `supabase start` / `db reset` still
proves the SQL.

Manual push still works after linking (see below):

```bash
pnpm supabase db push
```

Prefer **one** production apply path. This repo uses GitHub Actions, not the
Supabase GitHub Integration, so migration history stays reviewable in git.

### Syncing from cloud (first-time or schema drift)

If the cloud DB was changed manually or you want to pull the current schema:

```bash
pnpm supabase link --project-ref <project-id>
pnpm supabase db pull
```

This creates a new migration from the remote schema. Review it, then:

```bash
pnpm supabase db reset   # Apply locally
```

## Linking to Cloud

One-time setup to connect local to your Supabase project:

```bash
pnpm supabase login
pnpm supabase link --project-ref <project-id>
```

Get `<project-id>` from: https://app.supabase.com/project/_/settings/general

## Workflow Summary

| Task | Command |
|------|---------|
| Start local stack | `pnpm supabase start` |
| Stop local stack | `pnpm supabase stop` |
| Reset DB (apply migrations + seed) | `pnpm supabase db reset` |
| New migration | `pnpm supabase migration new <name>` |
| Push migrations to cloud | `pnpm supabase db push` (CI does this on merge to `main`) |
| RPC / Realtime integration tests | `pnpm test:integration` |
| Pull schema from cloud | `pnpm supabase db pull` |
| Diff local vs remote | `pnpm supabase db diff` |

## Schema Source

The initial migration (`20250110000000_okhabit_initial_schema.sql`) is derived from `app/supabase-schema.sql`. It is idempotent so it can be applied to both fresh local DBs and cloud DBs that were set up manually.

For future schema changes, prefer migrations over editing `app/supabase-schema.sql` directly. You can keep that file as documentation by regenerating it from migrations if needed.
