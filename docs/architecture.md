# Architecture (cross-cutting)

Baseline every feature doc references. Read this before `auth.md`, `registration.md`, `home.md`, `komsel.md`, `giving.md`, `sermons.md`.

## Stack

- Next.js App Router on Vercel (Node runtime, `export const runtime = "nodejs"`).
- Supabase Postgres via pooler URL (`:6543`, `prepare: false`) — see `src/db/client.ts`.
- Drizzle ORM. Migrations in `src/db/migrations` via `drizzle-kit`, run in CI or locally — never at runtime.
- Supabase Storage for uploaded media (images, audio, transfer-proof).
- YouTube embed URLs for long-form video (sermons). Stored as `youtube_id TEXT`.
- Mobile client: Flutter Android. Web CMS + JSON API share same Next.js app.

## Modular monolith

`src/features/<feature>/{data,business,presentation}` + `src/shared`. Cross-feature imports go through the target feature's `index.ts` only. See `AGENTS.md`.

## Auth (current)

**No auth in v1.** All endpoints public. Admin CMS + mobile client hit the same open endpoints.

Design implications kept anyway so auth can be added without breaking contracts:
- Every write endpoint takes `actor` fields (`created_by`, `updated_by`) as `TEXT NULL` — populate when auth lands.
- Every list endpoint supports filters even where a future role would scope automatically.
- No cookies-only assumptions. No CSRF middleware. No HTML redirects on API routes.

When auth is added, see `docs/auth.md` (Phase 1).

## Conventions

### Casing

- **JSON payloads: `camelCase`** in and out.
- DB columns: `snake_case` (Drizzle maps).
- URL paths: `kebab-case`, plural resource names (`/api/renungans`, `/api/cell-groups`).

### IDs

- Internal PK: `BIGSERIAL`.
- **Wire format: string** (`"12"`) — BigInt safe for Flutter/JS clients.

### Dates & time

- All timestamps: `TIMESTAMPTZ` in DB, ISO 8601 with offset on wire (`"2026-09-07T05:25:22.633Z"`).
- Calendar dates (no time): `DATE` in DB, `"YYYY-MM-DD"` on wire.
- Server is source of truth. Client never sends `created_at`/`updated_at`.
- Timezone reference: `Asia/Jakarta` (`WIB`, UTC+7) for any business-day boundary (e.g. daily renungan cutoff).

### Money

- **IDR integer rupiah** (whole rupiah, no cents). Column type `BIGINT`. Field name `amount_idr` (DB) / `amountIdr` (wire).
- Explicit exception to global R19e (cents). Documented here because IDR has no sub-unit in practice.
- Never `FLOAT`/`DOUBLE`. Never format-with-thousand-separators server-side — client formats.

### Locale

- **id-ID only.** All UI copy, error messages, notification strings in Bahasa Indonesia.
- Field names on wire stay English (`title`, `content`, `amountIdr`) — data, not copy.

### Booleans

- `is_` / `has_` prefix in DB. `isActive`, `hasContent` on wire.

## API shape

### Base

`/api/<resource>` — REST-shaped, plural, kebab-case.

### Verbs

| Verb   | Purpose                                  |
|--------|------------------------------------------|
| `GET`  | List (with query filters) or fetch one.  |
| `POST` | Create.                                  |
| `PUT`  | Full replace of a resource.              |
| `PATCH`| Partial update.                          |
| `DELETE` | Soft delete (sets `deleted_at`).       |

### Pagination

Cursor-based for lists that grow unbounded (donations, warta feed). Offset-based only for admin tables with known small `N`.

Cursor request:

```
GET /api/warta?limit=20&cursor=<opaque>
```

Cursor response envelope:

```json
{
  "items": [ ... ],
  "nextCursor": "eyJpZCI6IjEyMyJ9",
  "hasMore": true
}
```

`nextCursor` is base64-encoded JSON of the last item's sort keys. Opaque to client. `null` when `hasMore` is `false`.

`limit` default `20`, max `100`.

### Success envelope

Single resource: return the resource directly.

```json
{ "id": "42", "title": "...", "createdAt": "..." }
```

List: envelope with `items` (see pagination).

### Error envelope

Every 4xx / 5xx returns:

```json
{
  "error": "human-readable Bahasa Indonesia message",
  "code": "MACHINE_CODE",
  "issues": [
    { "path": "email", "message": "Email tidak valid" }
  ]
}
```

- `code`: SCREAMING_SNAKE, stable across releases. Client switches on `code`, not `error`.
- `issues`: present only on `400` validation failures (Zod flatten).
- Never leak stack traces. Never `500` for validation.

Standard codes:

| HTTP | code                      | When                                          |
|------|---------------------------|-----------------------------------------------|
| 400  | `VALIDATION_ERROR`        | Zod safeParse failed.                         |
| 400  | `INVALID_QUERY`           | Bad query params (out-of-range, malformed).   |
| 404  | `NOT_FOUND`               | Resource missing or soft-deleted.             |
| 409  | `CONFLICT`                | Duplicate (service-enforced uniqueness).      |
| 413  | `PAYLOAD_TOO_LARGE`       | Upload > limit.                               |
| 415  | `UNSUPPORTED_MEDIA_TYPE`  | Wrong file mime.                              |
| 422  | `BUSINESS_RULE_VIOLATION` | Domain rule failed (e.g. donation < min).     |
| 500  | `INTERNAL_ERROR`          | Unhandled. Logged with request id.            |

## Database rules (recap of AGENTS.md)

- No foreign keys. No cascades. No `CHECK` / business `UNIQUE`. No triggers / stored procedures.
- Every logical FK column gets an index + comment: `// logical FK: <table>.<col> → <ref>.<col> (enforced in service)`.
- Every table: `created_at`, `updated_at`, `deleted_at` (soft delete).
- No `ENUM`. Use lookup tables (e.g. `donation_funds`, `registration_statuses`).
- Money: `BIGINT` rupiah (see above).

## Validation

Zod at every boundary (`business/schema.ts`). Route handler → `safeParse` → `400 VALIDATION_ERROR` with flattened issues. Data layer trusts. See `AGENTS.md` "Validation: Zod".

## Media & files

### Images (photos, transfer proof, thumbnails)

- Bucket: `public-media` (public read) for church-visible content.
- Bucket: `private-uploads` (signed URL, TTL 7d) for transfer-proof and personal docs.
- Client uploads via signed upload URL from server (`POST /api/uploads/sign`). Server never proxies file bytes.
- Stored path pattern: `<feature>/<yyyy>/<mm>/<uuid>.<ext>`.
- Max size: 5 MB image, 10 MB proof. `PAYLOAD_TOO_LARGE` beyond.
- Allowed mime: `image/jpeg`, `image/png`, `image/webp`. `UNSUPPORTED_MEDIA_TYPE` otherwise.

### Video (sermons, worship)

- Stored as **YouTube embed only**. DB column `youtube_id TEXT NOT NULL` (11-char id). Never store URL — build client-side.
- Zod validates `^[a-zA-Z0-9_-]{11}$`.

### Audio (short devotionals, sermon audio if standalone)

- Supabase Storage `public-media/audio/...`. Direct URL served.

## CMS scope

Admin pages under `app/(cms)/<feature>/...`. Thin: parse params → call `business/*` → render. All CRUD goes through the same JSON API the mobile app hits — no separate admin RPC.

## Rate limits

Deferred. When added: per-IP token bucket at Vercel Edge middleware. Endpoints likely limited: public registration submit, donation submit.

## Environment

- `DATABASE_URL` — pooler URL, port 6543, `?prepare=false`.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — set in Vercel dashboard per env.
- `.env.local` local only. `.env.example` in repo.

## Open questions (parked)

- Push notifications channel (FCM vs OneSignal).
- Search backend if content grows (Postgres FTS vs Meilisearch).
- Admin RBAC when auth lands.
