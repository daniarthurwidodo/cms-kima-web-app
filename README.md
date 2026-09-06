# cms-kima-web-app

CMS/admin backend for the KIMA Flutter Android client. Next.js on Vercel,
Supabase for Postgres + auth. See [AGENTS.md](./AGENTS.md) for architecture and
conventions.

## Getting started

Requires [Podman](https://podman.io/) with a running machine — the whole
Supabase backend runs locally in containers.

```bash
podman machine start
pnpm install
cp .env.local.example .env.local

pnpm dev:up        # start Postgres, auth, Studio, pooler
pnpm db:migrate    # apply Drizzle migrations
pnpm dev           # http://localhost:3000
```

Full walkthrough, ports and troubleshooting: [docs/local-development.md](./docs/local-development.md).

## Scripts

| | |
|---|---|
| `pnpm dev` / `build` / `start` / `lint` | Next.js |
| `pnpm dev:up` / `dev:down` / `dev:status` | local Supabase stack |
| `pnpm dev:reset` | wipe local DB, re-migrate, re-seed |
| `pnpm db:generate` / `db:migrate` / `db:push` / `db:studio` | Drizzle |

## Environments

Local, staging and production differ only by environment variables — see
[docs/environments.md](./docs/environments.md). `.env.example` is the canonical
template; only `*.example` files are committed.

## Docs

- [docs/local-development.md](./docs/local-development.md)
- [docs/environments.md](./docs/environments.md)
- [docs/renungan.md](./docs/renungan.md) — daily devotional module
