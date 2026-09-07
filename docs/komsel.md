# Komsel (Cell Group)

Church cell-group directory + weekly discussion materials ("Materi Komsel"). Mobile shows nearest groups, browses materials archive, and plays/downloads the featured weekly material. Admin CMS manages groups + publishes materials.

Base paths:
- `/api/komsel-groups`
- `/api/komsel-materials`

Feature folder: `src/features/komsel/{data,business,presentation}`.

Read `docs/architecture.md` first.

## Ownership shift from Phase 2

Phase 2 registration described a `komsel_locations` lookup with `{code, label}`. That table **moves to this feature** and expands into `komsel_groups` (richer fields: region, PIC/leader, description, meeting time). The stable `code` column stays as the join key so registration keeps working.

Registration keeps consuming it via cross-feature import: `komsel/index.ts` re-exports `listActiveGroups()` returning `{code, label}` — the exact shape registration's `GET /api/komsel-locations` needs. Registration DTO/API paths are unchanged.

Migration path: Phase 2's `NNNN_create_komsel_locations.sql` is superseded — replace with `NNNN_create_komsel_groups.sql` before either feature ships. If Phase 2 already ran, ship one migration that renames the table + adds new columns.

## Data model

### Table: `komsel_groups`

| Column           | Type                    | Notes                                                                  |
|------------------|-------------------------|------------------------------------------------------------------------|
| `id`             | `BIGSERIAL PK`          |                                                                        |
| `code`           | `TEXT NOT NULL`         | Stable join key. Service-unique. e.g. `jaksel-kemang`, `online`.       |
| `label`          | `TEXT NOT NULL`         | id-ID display. e.g. `Komsel Kemang (Jakarta Selatan)`.                 |
| `region`         | `TEXT NOT NULL`         | Regional cluster. e.g. `jakarta-selatan`, `tangerang`, `online`.       |
| `description`    | `TEXT NULL`             | Optional short blurb.                                                  |
| `leader_name`    | `TEXT NOT NULL`         | Display name of PIC. e.g. `Bpk. Kevin Santoso`.                        |
| `leader_phone_wa`| `TEXT NULL`             | WhatsApp contact.                                                      |
| `leader_photo_path` | `TEXT NULL`          | Supabase Storage path in `public-media`.                               |
| `meeting_day`    | `TEXT NULL`             | `sunday..saturday`. Null when varies.                                  |
| `meeting_time`   | `TEXT NULL`             | `HH:mm`. Null when varies.                                             |
| `meeting_address`| `TEXT NULL`             | Free text; group may rotate homes.                                     |
| `is_active`      | `BOOLEAN NOT NULL`      | `DEFAULT true`. Hidden from public when `false`.                       |
| `sort_order`     | `INT NOT NULL`          | `DEFAULT 0`.                                                           |
| `created_at`, `updated_at`, `deleted_at` | | Standard.                                                            |

Indexes:
- `idx_komsel_groups_code` on `(code)` — join key.
- `idx_komsel_groups_region` on `(region)` — region filter.
- `idx_komsel_groups_is_active` on `(is_active)`.

### Table: `komsel_materials`

Weekly discussion guide. Optional audio (Supabase Storage) + optional PDF download.

| Column                 | Type                    | Notes                                                             |
|------------------------|-------------------------|-------------------------------------------------------------------|
| `id`                   | `BIGSERIAL PK`          |                                                                   |
| `slug`                 | `TEXT NOT NULL`         | Kebab-case, service-unique. For deep links.                       |
| `title`                | `TEXT NOT NULL`         | e.g. `Kasih yang Memulihkan Relasi Rapuh`.                        |
| `theme`                | `TEXT NULL`             | Short thematic tag. e.g. `Relasi`, `Integritas`.                  |
| `scripture_ref`        | `TEXT NOT NULL`         | e.g. `1 Korintus 13:4-7`.                                         |
| `summary`              | `TEXT NOT NULL`         | 1-2 paragraph intro (plain text).                                 |
| `content_md`           | `TEXT NOT NULL`         | Markdown body (leader guide).                                     |
| `audio_path`           | `TEXT NULL`             | Supabase Storage path in `public-media/audio/…`.                  |
| `audio_duration_sec`   | `INT NULL`              | Populated by admin on upload.                                     |
| `pdf_path`             | `TEXT NULL`             | Supabase Storage path in `public-media/pdf/…`.                    |
| `cover_image_path`     | `TEXT NULL`             | Supabase Storage path in `public-media/`.                         |
| `week_of`              | `DATE NOT NULL`         | Monday of the target week (`YYYY-MM-DD`). Service-normalized.     |
| `is_featured`          | `BOOLEAN NOT NULL`      | `DEFAULT false`. Exactly one featured at a time (service-checked).|
| `published_at`         | `TIMESTAMPTZ NOT NULL`  | Public filter `published_at <= now()`.                            |
| `created_at`, `updated_at`, `deleted_at` | |                                                             |

Indexes:
- `idx_komsel_materials_slug` on `(slug)`.
- `idx_komsel_materials_week_of` on `(week_of DESC)` — feed order.
- `idx_komsel_materials_published_at` on `(published_at DESC)`.
- `idx_komsel_materials_is_featured` on `(is_featured)`.

### Table: `komsel_material_questions`

Discussion questions belong to one material. Ordered.

| Column            | Type                    | Notes                                                       |
|-------------------|-------------------------|-------------------------------------------------------------|
| `id`              | `BIGSERIAL PK`          |                                                             |
| `material_id`     | `BIGINT NOT NULL`       | Logical FK: `komsel_material_questions.material_id → komsel_materials.id`. |
| `question`        | `TEXT NOT NULL`         |                                                             |
| `sort_order`      | `INT NOT NULL`          | `DEFAULT 0`. Order within material.                         |
| `created_at`, `updated_at`, `deleted_at` | |                                                       |

Indexes:
- `idx_komsel_material_questions_material_id` on `(material_id)`.

Comment in migration:
- `// logical FK: komsel_material_questions.material_id → komsel_materials.id (service-enforced cascade)`

### (Deferred) Table: `komsel_attendance`

Not shipped v1 — requires auth to be trustworthy. Documented for Phase 1+.

Sketch: `(id, material_id, group_code, attendee_name, attended_at, submitted_by, timestamps)`.

## API

All Node runtime, JSON. No auth v1 — admin endpoints public, will gate later.

### `GET /api/komsel-groups` — public list

Query:

| Param     | Type                  | Default   | Notes                                          |
|-----------|-----------------------|-----------|------------------------------------------------|
| `region`  | `string`              | —         | Filter by region key.                          |
| `q`       | `string`              | —         | Match `label` or `leader_name`.                |
| `active`  | `boolean`             | `true`    | Admin can set `false` to see hidden.           |

No pagination (small set). Sort: `sort_order ASC, label ASC`.

Response `200`:

```json
{
  "items": [
    {
      "code": "jaksel-kemang",
      "label": "Komsel Kemang (Jakarta Selatan)",
      "region": "jakarta-selatan",
      "description": "Setiap Jumat malam di Kemang.",
      "leaderName": "Sdri. Jessica Wijaya",
      "leaderPhoneWa": "081234567890",
      "leaderPhotoUrl": "https://…/leaders/xyz.jpg",
      "meetingDay": "friday",
      "meetingTime": "19:30",
      "meetingAddress": "Jl. Kemang Raya No. 12",
      "isActive": true
    }
  ]
}
```

Compact variant (for registration form dropdown) available at `/api/komsel-groups?fields=code,label`. Returns:

```json
{ "items": [{ "code": "jaksel-kemang", "label": "Komsel Kemang (Jakarta Selatan)" }] }
```

`?fields=` is a whitelist: `code`, `label`, `region`. Unknown fields → `400 INVALID_QUERY`.

Registration Phase 2's `GET /api/komsel-locations` becomes a thin alias that calls this with `fields=code,label&active=true`. Old URL kept for mobile app backwards compat.

### `GET /api/komsel-groups/:code` — public detail

Response `200`: full group DTO. `404 NOT_FOUND` when missing/inactive/soft-deleted.

### `POST /api/komsel-groups` — admin create

Body matches list DTO (paths not URLs; server maps to signed URLs on read).

### `PATCH /api/komsel-groups/:code` — admin update

### `DELETE /api/komsel-groups/:code` — admin soft delete

### `GET /api/komsel-materials` — public list (archive feed)

Query:

| Param       | Type                  | Default            | Notes                                                    |
|-------------|-----------------------|--------------------|----------------------------------------------------------|
| `q`         | `string`              | —                  | Match `title`, `theme`, `scripture_ref`.                 |
| `theme`     | `string`              | —                  | Exact theme filter.                                      |
| `featured`  | `boolean`             | —                  | When `true`, only `is_featured = true`.                  |
| `limit`     | `int` 1..50           | `20`               |                                                          |
| `cursor`    | `string`              | —                  | Opaque.                                                  |

Default status filter: `published_at <= now() AND deleted_at IS NULL`. Sort: `week_of DESC, id DESC`.

Response `200`:

```json
{
  "items": [
    {
      "id": "88",
      "slug": "kasih-yang-memulihkan-relasi-rapuh",
      "title": "Kasih yang Memulihkan Relasi Rapuh",
      "theme": "Relasi",
      "scriptureRef": "1 Korintus 13:4-7",
      "summary": "…",
      "coverImageUrl": "https://…/covers/xyz.jpg",
      "hasAudio": true,
      "audioDurationSec": 1245,
      "hasPdf": true,
      "weekOf": "2026-09-07",
      "isFeatured": true,
      "publishedAt": "2026-09-05T09:00:00.000Z"
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```

`hasAudio` / `hasPdf` are boolean flags. URLs served only on detail endpoint to keep list light.

### `GET /api/komsel-materials/featured` — public featured

Returns the single featured material (or `null`). Used by Home + mobile Komsel hero card.

Response `200`:

```json
{ "material": { …MaterialDetailDto } }
```

or `{ "material": null }` when none.

### `GET /api/komsel-materials/:slug` — public detail

Response `200` (`MaterialDetailDto`):

```json
{
  "id": "88",
  "slug": "kasih-yang-memulihkan-relasi-rapuh",
  "title": "Kasih yang Memulihkan Relasi Rapuh",
  "theme": "Relasi",
  "scriptureRef": "1 Korintus 13:4-7",
  "summary": "…",
  "contentMd": "…markdown…",
  "coverImageUrl": "https://…/covers/xyz.jpg",
  "audioUrl": "https://…/audio/xyz.mp3",
  "audioDurationSec": 1245,
  "pdfUrl": "https://…/pdf/xyz.pdf",
  "weekOf": "2026-09-07",
  "isFeatured": true,
  "publishedAt": "2026-09-05T09:00:00.000Z",
  "questions": [
    { "id": "1", "question": "Apa relasi yang paling perlu kamu pulihkan minggu ini?", "sortOrder": 0 },
    { "id": "2", "question": "Bagaimana ayat ini menantang caramu mengasihi?", "sortOrder": 1 }
  ]
}
```

`404 NOT_FOUND` when slug missing / unpublished / soft-deleted.

### `POST /api/komsel-materials` — admin create

Body:

```json
{
  "slug": "kasih-yang-memulihkan-relasi-rapuh",
  "title": "…",
  "theme": "Relasi",
  "scriptureRef": "1 Korintus 13:4-7",
  "summary": "…",
  "contentMd": "…",
  "coverImagePath": "komsel/2026/09/xyz.jpg",
  "audioPath": "komsel/audio/xyz.mp3",
  "audioDurationSec": 1245,
  "pdfPath": "komsel/pdf/xyz.pdf",
  "weekOf": "2026-09-07",
  "isFeatured": true,
  "publishedAt": "2026-09-05T09:00:00.000Z",
  "questions": [
    { "question": "…", "sortOrder": 0 }
  ]
}
```

Rules:
- `slug` service-unique across non-deleted rows. `409 CONFLICT` on collision.
- `weekOf` normalized server-side to the Monday of that week (Asia/Jakarta).
- `isFeatured = true` unsets the flag on any previously featured row inside the same transaction (service-enforced single-featured invariant).
- `questions` is optional, replaces prior set (see PATCH).

Response `201`: `MaterialDetailDto`.

### `PATCH /api/komsel-materials/:slug` — admin update

Body: any subset of create body. When `questions` is present, it **replaces** the full set (deletes rows not in payload, upserts by `sort_order`). Omit `questions` to keep as-is.

### `DELETE /api/komsel-materials/:slug` — admin soft delete

Sets `deleted_at` on material and cascades soft delete to child questions in the same transaction.

## Contract (Zod)

Location: `src/features/komsel/business/schema.ts`.

```ts
import { z } from "zod";

export const KOMSEL_REGIONS = [
  "jakarta-barat", "jakarta-pusat", "jakarta-selatan", "jakarta-timur", "jakarta-utara",
  "tangerang", "bekasi", "depok", "bogor", "online",
] as const;

export const DAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HHMM_RE = /^\d{2}:\d{2}$/;
const PHONE_WA_RE = /^(\+?62|0)8[0-9]{7,12}$/;

export const upsertGroupSchema = z.object({
  code: z.string().trim().regex(CODE_RE).min(2).max(40),
  label: z.string().trim().min(2).max(120),
  region: z.enum(KOMSEL_REGIONS),
  description: z.string().trim().max(500).optional().nullable(),
  leaderName: z.string().trim().min(2).max(120),
  leaderPhoneWa: z.string().trim().regex(PHONE_WA_RE).optional().nullable(),
  leaderPhotoPath: z.string().trim().max(300).optional().nullable(),
  meetingDay: z.enum(DAYS).optional().nullable(),
  meetingTime: z.string().regex(HHMM_RE).optional().nullable(),
  meetingAddress: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const listGroupsQuery = z.object({
  region: z.enum(KOMSEL_REGIONS).optional(),
  q: z.string().trim().max(80).optional(),
  active: z.coerce.boolean().default(true),
  fields: z.string().trim().max(60).optional(),
});

export const upsertMaterialSchema = z.object({
  slug: z.string().trim().regex(SLUG_RE).min(3).max(120),
  title: z.string().trim().min(2).max(200),
  theme: z.string().trim().max(60).optional().nullable(),
  scriptureRef: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(2).max(1000),
  contentMd: z.string().trim().min(2).max(50_000),
  coverImagePath: z.string().trim().max(300).optional().nullable(),
  audioPath: z.string().trim().max(300).optional().nullable(),
  audioDurationSec: z.coerce.number().int().min(0).max(24 * 3600).optional().nullable(),
  pdfPath: z.string().trim().max(300).optional().nullable(),
  weekOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isFeatured: z.boolean().default(false),
  publishedAt: z.string().datetime(),
  questions: z.array(z.object({
    question: z.string().trim().min(4).max(500),
    sortOrder: z.coerce.number().int().min(0).max(999),
  })).max(20).optional(),
});
export const patchMaterialSchema = upsertMaterialSchema.partial();

export const listMaterialsQuery = z.object({
  q: z.string().trim().max(80).optional(),
  theme: z.string().trim().max(60).optional(),
  featured: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});
```

## DTOs

Location: `src/features/komsel/business/dto.ts`.

```ts
export interface KomselGroupDto {
  code: string;
  label: string;
  region: string;
  description: string | null;
  leaderName: string;
  leaderPhoneWa: string | null;
  leaderPhotoUrl: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  meetingAddress: string | null;
  isActive: boolean;
}

export interface KomselGroupCompactDto {
  code: string;
  label: string;
  region?: string;
}

export interface KomselMaterialListItemDto {
  id: string;
  slug: string;
  title: string;
  theme: string | null;
  scriptureRef: string;
  summary: string;
  coverImageUrl: string | null;
  hasAudio: boolean;
  audioDurationSec: number | null;
  hasPdf: boolean;
  weekOf: string;
  isFeatured: boolean;
  publishedAt: string;
}

export interface KomselMaterialQuestionDto {
  id: string;
  question: string;
  sortOrder: number;
}

export interface KomselMaterialDetailDto {
  id: string;
  slug: string;
  title: string;
  theme: string | null;
  scriptureRef: string;
  summary: string;
  contentMd: string;
  coverImageUrl: string | null;
  audioUrl: string | null;
  audioDurationSec: number | null;
  pdfUrl: string | null;
  weekOf: string;
  isFeatured: boolean;
  publishedAt: string;
  questions: KomselMaterialQuestionDto[];
}
```

## Service invariants

- **Single featured**: on `POST` or `PATCH` where `isFeatured = true`, wrap in a transaction that unsets `is_featured` on all other rows, then sets on target. Reject `PATCH { isFeatured: false }` if it would leave zero featured (no-op — reject with `422 BUSINESS_RULE_VIOLATION` code `MUST_HAVE_ONE_FEATURED`).
- **Slug uniqueness**: read-then-write inside transaction; `409 CONFLICT` on race.
- **Cascade soft delete**: deleting a material sets `deleted_at` on child questions in same tx (replaces `ON DELETE CASCADE`).
- **`weekOf` normalization**: server converts to Monday of that ISO week in `Asia/Jakarta`. Client's exact date is ignored.

## Layer wiring

- `data/schema.ts` — Drizzle `komsel_groups`, `komsel_materials`, `komsel_material_questions`.
- `data/group.repo.ts`, `data/material.repo.ts`, `data/question.repo.ts` — raw CRUD.
- `business/schema.ts`, `business/dto.ts` — above.
- `business/group.service.ts` — `list`, `get`, `create`, `update`, `softDelete`, `listCompact`.
- `business/material.service.ts` — `list`, `getBySlug`, `getFeatured`, `create`, `update`, `softDelete`. Enforces single-featured + slug-unique + cascade.
- `business/payload.ts` — pure builder: input → repo insert args.
- `business/media-url.ts` — resolves Storage `path` → signed/public URL. Reused across DTOs.
- `presentation/*.controller.ts` — response serializers.
- Route handlers under `app/api/komsel-groups/` and `app/api/komsel-materials/`.
- Admin CMS under `app/(cms)/komsel/…`.

Public API surface exported via `src/features/komsel/index.ts`:
- `listActiveGroupsCompact()` — for registration.
- `getFeaturedMaterial()` — for Home.
- Types `KomselGroupCompactDto`, `KomselMaterialListItemDto`, `KomselMaterialDetailDto`.

## CMS UX

- **Groups list** — table: label, region, leader, active toggle. Search + region filter. Row → editor.
- **Group editor** — form with photo upload (signed URL). Toggle active. Sort order.
- **Materials list** — table sortable by `week_of`. Featured star. Publish status chip.
- **Material editor** — split view: form + markdown preview. Cover/audio/PDF uploads. Questions repeater (add/remove/reorder). Featured toggle warns "akan menggantikan materi featured saat ini".

## Mobile UX contract

- Komsel tab open → single `GET /api/komsel-materials?limit=20` + `GET /api/komsel-groups` fired in parallel.
- Featured card: hero at top → `GET /api/komsel-materials/featured` inline result (or first item where `isFeatured = true` from the list).
- Tap material → `GET /api/komsel-materials/:slug`. Renders summary, scripture, markdown, questions accordion, audio player, PDF download button.
- Tap group → `GET /api/komsel-groups/:code`. Contact leader via `wa.me/{leaderPhoneWa}`.
- "Belum Bergabung Komsel?" CTA → deep-link to registration form.

## Migrations

1. `NNNN_create_komsel_groups.sql` — table + indexes + seed the six initial codes (`jakbar-puri`, `jakpus-menteng`, `jaksel-kemang`, `jaksel-senopati`, `tangerang-bsd`, `online`) with placeholder leader names to be edited in CMS. If Phase 2 `komsel_locations` already applied, this migration `ALTER TABLE ... RENAME + ADD COLUMN` instead.
2. `NNNN_create_komsel_materials.sql` — materials + questions tables + indexes.

Both reversible.

## Deferred / parked

- **Attendance**: needs auth. Table sketched above, ship in Phase 1+.
- **Leader-only edits**: needs role auth.
- **Push notif "Materi minggu ini sudah tersedia"**: Phase 6+.
- **Full-text search** across markdown: v1 uses `ILIKE` on `title`/`theme`/`scripture_ref`. Move to Postgres FTS if archive > ~500 rows.
- **Multi-featured** (per region): v1 forces single featured globally. Revisit if regional programs diverge.
