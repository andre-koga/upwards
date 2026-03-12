# OkHabit Supabase Local Development

Local Supabase stack for development, with migrations kept in sync with the cloud project.

## Prerequisites

- **Docker** (or compatible: Colima, OrbStack, Podman, Rancher Desktop)
- If port 54322 is in use by another Supabase project, run `supabase stop --project-id <other-project>` or change `[db] port` in `config.toml`
- **Supabase CLI** — project has it as dev dependency. Use `pnpm supabase:start` or `npx supabase start`. Alternatively: `brew install supabase/tap/supabase`

## Quick Start

```bash
# From project root
supabase start
```

This starts the local stack and applies migrations. You'll get:

- **API URL:** http://localhost:54321
- **Studio:** http://localhost:54323
- **anon key** and **service_role key** in the output

## Local Development

1. **Start local Supabase:**
   ```bash
   supabase start
   ```

2. **Copy `app/.env.example` to `app/.env.local`** and add the anon key from `supabase start` output:
   ```env
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from supabase start>
   ```

3. **Run the app:**
   ```bash
   cd app && pnpm dev
   ```

4. **Stop when done:**
   ```bash
   supabase stop
   ```

## Migrations

### Creating a new migration

```bash
supabase migration new <descriptive_name>
```

Edit the new file in `supabase/migrations/`, then:

```bash
supabase db reset   # Apply locally
```

### Pushing to cloud

After linking (see below):

```bash
supabase db push
```

### Syncing from cloud (first-time or schema drift)

If the cloud DB was changed manually or you want to pull the current schema:

```bash
supabase link --project-ref <project-id>
supabase db pull
```

This creates a new migration from the remote schema. Review it, then:

```bash
supabase db reset   # Apply locally
```

## Linking to Cloud

One-time setup to connect local to your Supabase project:

```bash
supabase login
supabase link --project-ref <project-id>
```

Get `<project-id>` from: https://app.supabase.com/project/_/settings/general

## Workflow Summary

| Task | Command |
|------|---------|
| Start local stack | `supabase start` |
| Stop local stack | `supabase stop` |
| Reset DB (apply migrations + seed) | `supabase db reset` |
| New migration | `supabase migration new <name>` |
| Push migrations to cloud | `supabase db push` |
| Pull schema from cloud | `supabase db pull` |
| Diff local vs remote | `supabase db diff` |

## Schema Source

The initial migration (`20250110000000_okhabit_initial_schema.sql`) is derived from `app/supabase-schema.sql`. It is idempotent so it can be applied to both fresh local DBs and cloud DBs that were set up manually.

For future schema changes, prefer migrations over editing `app/supabase-schema.sql` directly. You can keep that file as documentation by regenerating it from migrations if needed.
