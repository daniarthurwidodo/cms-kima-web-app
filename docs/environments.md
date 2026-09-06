# Environments

Three environments, one codebase. They differ only in environment variables —
no build flags, no conditional imports.

| | Local | Staging | Production |
|---|---|---|---|
| Supabase | local stack in Podman | Supabase staging project | Supabase production project |
| Where vars live | `.env.local` (gitignored) | Vercel → Preview | Vercel → Production |
| `APP_ENV` | `local` | `staging` | `production` |
| Postgres (runtime) | Supavisor pooler `127.0.0.1:54329` | project pooler `:6543` | project pooler `:6543` |
| Postgres (migrations) | direct `127.0.0.1:54322` | project direct `:5432` | project direct `:5432` |
| Auth (GoTrue) | `http://127.0.0.1:54321` | `https://<ref>.supabase.co` | `https://<ref>.supabase.co` |
| Migrations run by | you, `pnpm db:migrate` | CI on merge to `main` | CI, gated on release |

`.env.example` is the canonical template; `.env.local.example` is the filled-in
local copy. Only `*.example` files are committed — `.gitignore` blocks `.env*`.

## Why two Postgres URLs

`DATABASE_URL` is the **transaction-mode pooler**, which is what serverless
functions must use (see `AGENTS.md` → Vercel Deployment Constraints). Transaction
pooling cannot hold prepared statements, hence `prepare: false` in
`src/db/client.ts`, and it cannot reliably run DDL.

`DIRECT_URL` is the direct 5432 connection and is used **only** by `drizzle-kit`
(migrate / push / studio). `drizzle.config.ts` prefers it and falls back to
`DATABASE_URL`.

The local stack enables Supavisor (`[db.pooler] enabled = true` in
`supabase/config.toml`) specifically so this split exists locally too — a
pooler-only bug shows up on your machine rather than in production.

## Setting Vercel variables

Set them per-environment in the dashboard, or:

```bash
vercel env add DATABASE_URL preview        # staging
vercel env add DATABASE_URL production
```

Every key in `.env.example` needs a value in both Preview and Production.
`NEXT_PUBLIC_*` values are baked into the client bundle at build time, so a
change to them requires a redeploy, not just a restart.

## Staging data

By default Vercel Preview deployments point at whatever `DATABASE_URL` is set
for the Preview environment. Either give staging its own Supabase project, or
use a Supabase branch and scope `DATABASE_URL` to it. Do not let previews write
to the production database.
