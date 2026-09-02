<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Product Context

This app is a **CMS CRUD** backend/admin. Primary consumer: a **Flutter Android client**. Deployed to **Vercel** — CMS UI + API served from the same Next.js app.

Implications:
- Every feature must expose its data via **JSON HTTP API** (`app/api/**/route.ts` route handlers or server actions callable over HTTP). The web UI is admin-side; the mobile app is a first-class client, not an afterthought.
- API contracts are the product. Version them, keep them stable, document request/response shapes in the feature's `presentation/` layer.
- Auth must work for both browser session (admin) and mobile token (Flutter). Design auth boundary accordingly.
- Payloads: JSON, snake_case or camelCase — pick one and stay consistent. Dates as ISO 8601 strings. Money as integer cents (see R19e).
- No web-only assumptions (cookies-only auth, HTML redirects, form-encoded bodies) in API endpoints — mobile client can't rely on them.
- CRUD-first: prefer thin, predictable REST-shaped endpoints over bespoke RPC unless a use case demands it.

## Vercel Deployment Constraints

- **Serverless runtime**. Every request = fresh function instance. No in-memory state between requests, no long-lived background workers, no local filesystem writes.
- **DB connections**: must use Supabase **pooler URL** (port 6543, transaction mode) with `prepare: false` — direct 5432 connections will exhaust the pool under cold-start fan-out. See `src/db/client.ts`.
- **Runtime**: default all route handlers/server actions to Node runtime (`export const runtime = "nodejs"`). Edge runtime does not support `postgres` driver.
- **Env vars**: set in Vercel dashboard (Production / Preview / Development). Never commit real secrets. `.env.local` for local only, `.env.example` in repo as template.
- **Migrations run in CI or locally, never at runtime.** Trigger `drizzle-kit migrate` from a GitHub Action or manually before deploy — Vercel build step should not touch schema (unpredictable ordering across preview branches).
- **Cold start budget**: keep top-level imports lean. Heavy libs behind lazy `await import()` in the handler, not at module scope.
- **Preview deploys** hit the same Supabase project by default. If preview needs isolated data, point `DATABASE_URL` at a Supabase branch or a separate project via Vercel env scoping.
- **Region**: pick the Vercel function region closest to the Supabase region to keep DB latency low.

# Architecture: Modular Monolith (Feature-Sliced)

Single Next.js app. Code grouped by **feature**, not by technical role. Each feature is self-contained and owns its full stack.

## Layout

```
app/                         # Next.js routes (presentation entrypoints only)
  (features)/<feature>/...   # route segments — thin, delegate to feature module

src/
  features/
    <feature>/               # e.g. auth, billing, config-filter, provider
      data/                  # Drizzle schema, repositories, queries, migrations for this feature
      business/              # services, use-cases, validators, payload builders, domain types
      presentation/          # feature-owned components, route handlers, server actions, API controllers
      index.ts               # public API of the feature (only export what other features may use)

  shared/                    # cross-feature reusable ONLY
    components/              # generic UI (Button, Modal, DataTable) — no feature logic
    services/                # cross-cutting (logger, auth client, http, config)
    utils/                   # pure helpers (formatters, guards, date, string)
    types/                   # shared primitive/domain types

  db/                        # global Drizzle client, root schema aggregation, migration runner
```

## Layer Rules (per feature)

1. **Data layer** (`data/`) — Drizzle schema + repositories. Raw CRUD, query building, transactions. No business rules. See R19k / R21.
2. **Business layer** (`business/`) — services, validation, payload builders, orchestration across repos. No I/O framework details, no JSX.
3. **Presentation / endpoint / controller layer** (`presentation/` + `app/` routes) — React components, server actions, route handlers (`app/api/**/route.ts`). Reads from business layer only. Never touches `data/` directly.
4. **Reusable layer** (`src/shared/`) — utilities, generic components, cross-cutting services. Zero feature-specific logic. If it references a feature, it belongs in that feature, not shared.

## Dependency Direction (strict)

```
presentation → business → data
      ↓            ↓        ↓
              shared (utils / components / services)
```

- Presentation may import from own feature + `shared`.
- Business may import from own `data` + `shared`.
- Data may import from `shared` only.
- **Feature → feature imports go through the target feature's `index.ts` public API.** No deep imports across features.
- **No circular feature deps.** If two features need each other, extract the shared piece into `shared/` or a new feature.

## When Adding Code

- New capability → new folder under `src/features/<name>/` with the four subfolders as needed.
- Reusable across ≥2 features → promote to `src/shared/`.
- Cross-feature workflow → new orchestrator feature, don't chain feature-to-feature imports.
- Route file in `app/` stays thin: parse params → call feature business function → render.

Applies with the global constitution (KISS, SoC R21, 3-layer separation, no DB business logic R19k).

# Validation: Zod

**All validation at trust boundaries goes through Zod.** No hand-rolled `typeof`/regex chains, no bespoke `assertX()` helpers when a schema does the same job.

## Where to validate

| Boundary                       | Schema location                                      | Notes                                                        |
|--------------------------------|------------------------------------------------------|--------------------------------------------------------------|
| API route handlers (`app/api/**`) | `src/features/<f>/business/schema.ts`             | `schema.safeParse(await req.json())` at the top of the handler. Return 400 with issues on failure. |
| Server actions                 | Same feature `business/schema.ts`                    | Validate inputs before touching data layer.                  |
| Client forms                   | `src/features/<f>/presentation/formSchema.ts`        | Use the same base schema when possible; extend with UI-only shape (e.g. `chapter` as string input). |
| External API responses         | Feature `business/` next to the client that calls them | Validate parsed JSON before it enters business logic.        |

Data layer (`data/`) does **not** validate — it trusts pre-validated inputs. Presentation may re-derive schemas from business schemas but never invents new validation rules that contradict the server.

## Rules

- One schema per shape. Reuse via `.extend()`, `.pick()`, `.omit()` — don't duplicate.
- Prefer `safeParse` at boundaries, `parse` deep inside where a failure is truly a bug.
- Infer types with `z.infer<typeof …>` / `z.input<>` / `z.output<>` — never hand-write the type alongside the schema.
- Coerce user input explicitly (`z.coerce.number()` or `.transform()`) — do not rely on JS implicit conversion. Follow R12b: any string→number conversion must reject `NaN`.
- Trim + normalize strings in the schema (`.trim().min(1)`) — presentation just wires values.
- Cross-field rules via `.refine()` / `.superRefine()`, not spread across handlers.
- On error, expose issues as `{ field: message }` (see `presentation/formSchema.ts::flattenIssues`) — never raw `ZodError` to the mobile client.
- Server responses to invalid input: `400` + `{ error: string, issues?: Array<{path, message}> }`. Never `500`.
- Do not use Zod inside hot loops (per-row validation across large query results). Validate at the boundary once.

## Anti-patterns

- Manual `if (!body || typeof body !== "object")` when a schema would say it.
- Bespoke `assertIsoDate`, `requireString`, custom regex checkers when Zod primitives cover them. Delete on sight.
- Duplicating the API payload shape across server and client — share via feature `index.ts` re-export.
- Silent `parse()` inside a `try/catch` that swallows the error. Errors are the whole point.

_(CLAUDE.md imports this file via `@AGENTS.md` — no duplication needed.)_
