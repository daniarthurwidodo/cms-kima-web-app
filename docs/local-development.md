# Local development

The whole Supabase backend runs locally in containers via **Podman** — Postgres,
GoTrue (auth), PostgREST, Kong, Storage, Realtime, Studio and the Supavisor
connection pooler. The Next.js dev server runs on the host.

Nothing here talks to the cloud project. See [environments.md](./environments.md)
for how local, staging and production differ.

## One-time setup

1. **Podman** with a running machine:

   ```bash
   podman machine start
   ```

2. **Install dependencies and env file:**

   ```bash
   pnpm install
   cp .env.local.example .env.local
   ```

## Every day

```bash
pnpm dev:up        # start the Supabase containers (first run pulls ~3 GB)
pnpm db:migrate    # apply Drizzle migrations
pnpm dev           # http://localhost:3000
```

`pnpm dev:down` stops the containers. Data survives a stop; `pnpm dev:reset`
wipes the database, re-applies migrations and re-runs `supabase/seed.sql`.

## Ports

| Service | URL |
|---|---|
| Next.js | http://localhost:3000 |
| Supabase API (Kong) | http://127.0.0.1:54321 |
| Studio | http://127.0.0.1:54323 |
| Postgres — direct | `127.0.0.1:54322` |
| Postgres — pooler | `127.0.0.1:54329` |
| Mailpit (captures all outbound mail) | http://127.0.0.1:54324 |

## Health checks

```bash
curl localhost:3000/api/health/db          # {"ok":true,"latencyMs":3}
curl localhost:3000/api/health/supabase    # {"ok":false,"error":"Auth session missing!"}
```

The second response is the **expected** anonymous result — it proves GoTrue
answered. A connection error would read differently.

## Creating a dev user

There is no email delivery locally (Mailpit swallows it), so create users directly:

```bash
curl -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H 'apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@local.test","password":"localdev123"}'
```

`pnpm dev:reset` removes it; re-run the command to get it back. Confirmation
emails, if enabled, appear in Mailpit.

## Migrations

Drizzle owns the schema. `src/db/migrations/` is the source of truth;
`supabase/migrations/` stays empty on purpose.

```bash
pnpm db:generate   # after editing src/db/schema.ts
pnpm db:migrate
pnpm db:studio
```

These use `DIRECT_URL` (port 54322), not the pooler — see
[environments.md](./environments.md#why-two-postgres-urls).

## Podman notes

`scripts/supabase.mjs` wraps the Supabase CLI and points `DOCKER_HOST` at
Podman's socket, so every `pnpm dev:*` script works without exporting anything.
Set `DOCKER_HOST` yourself to override (e.g. to use Docker instead).

Podman does **not** auto-create bind-mount sources the way Docker does, so
`supabase/{functions,migrations,schemas,snippets}/` each keep a `.gitkeep`. If
you see `statfs .../supabase/<dir>: no such file or directory`, a directory went
missing — recreate it.

## Troubleshooting

**`no tenant identifier provided`** — you pointed `DATABASE_URL` at the pooler
without the tenant suffix. The local username is `postgres.pooler-dev`, not
`postgres`.

**`prepared statement "..." already exists`** — `prepare: false` got dropped from
`src/db/client.ts`. Transaction pooling requires it.

**Port already in use** — another Supabase project is running. `pnpm supabase stop --all`.
