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

After `pnpm supabase db reset` (or first `start` with seed), two accounts are available for testing friends and goals:

| Email | Password | Username | Display name |
|-------|----------|----------|--------------|
| `test@test.com` | `password` | `testuser` | Test User |
| `friend@test.com` | `password` | `frienduser` | Friend User |

**Try the friends flow:** sign in as `test@test.com`, open Friends, send a request to `frienduser`. Sign out, sign in as `friend@test.com`, accept the request.

To add only the friend account without resetting your DB, run `supabase/scripts/seed-test-friend.sql` in Studio SQL Editor or via `psql` against your local database.

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

After linking (see below):

```bash
pnpm supabase db push
```

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
| Push migrations to cloud | `pnpm supabase db push` |
| Pull schema from cloud | `pnpm supabase db pull` |
| Diff local vs remote | `pnpm supabase db diff` |

## Schema Source

The initial migration (`20250110000000_okhabit_initial_schema.sql`) is derived from `app/supabase-schema.sql`. It is idempotent so it can be applied to both fresh local DBs and cloud DBs that were set up manually.

For future schema changes, prefer migrations over editing `app/supabase-schema.sql` directly. You can keep that file as documentation by regenerating it from migrations if needed.
