# Pendaftaran Jemaat Baru (Registration)

Public self-serve registration for new members of **GBI Kima Square**. Admin CMS reviews + approves submissions. No auth in v1 — anti-abuse handled by rate limit (deferred) + admin approval queue.

Base path: `/api/registrations`.
Feature folder: `src/features/registration/{data,business,presentation}`.

Read `docs/architecture.md` first for conventions (camelCase JSON, BigInt-as-string, error envelope, ISO 8601, IDR).

## Data model

### Table: `registrations`

| Column                 | Type                    | Notes                                                                                          |
|------------------------|-------------------------|------------------------------------------------------------------------------------------------|
| `id`                   | `BIGSERIAL PK`          | Surrogate.                                                                                     |
| `full_name`            | `TEXT NOT NULL`         |                                                                                                |
| `birth_date`           | `DATE NOT NULL`         | `YYYY-MM-DD`.                                                                                  |
| `birth_city`           | `TEXT NOT NULL`         |                                                                                                |
| `gender`               | `TEXT NOT NULL`         | Values: `laki-laki`, `perempuan`. Service-enforced.                                            |
| `marital_status`       | `TEXT NOT NULL`         | Values: `single`, `married`, `widowed`.                                                        |
| `phone_wa`             | `TEXT NOT NULL`         | E.164 preferred, stored as user-entered normalized. Regex `^(\+?62|0)8[0-9]{7,12}$`.           |
| `email`                | `TEXT NOT NULL`         | Lowercased, trimmed.                                                                           |
| `address`              | `TEXT NOT NULL`         | Full domicile address.                                                                         |
| `previous_church`      | `TEXT NULL`             | Optional. Null when never attended.                                                            |
| `baptism_status`       | `TEXT NOT NULL`         | Values: `sudah`, `belum`.                                                                      |
| `komsel_code`          | `TEXT NOT NULL`         | Lookup key. See `komsel_locations` below.                                                      |
| `ministry_interests`   | `TEXT[] NOT NULL`       | Zero or more of: `kids`, `multimedia`, `komsel`, `worship`. Empty array = no interest yet.     |
| `status`               | `TEXT NOT NULL`         | Values: `pending`, `approved`, `rejected`. Default `pending`.                                  |
| `reviewed_at`          | `TIMESTAMPTZ NULL`      | Set when admin transitions status.                                                             |
| `reviewed_by`          | `TEXT NULL`             | Admin identifier. Populated when auth lands.                                                   |
| `rejection_reason`     | `TEXT NULL`             | Required when `status = rejected`. Service-enforced.                                           |
| `created_at`           | `TIMESTAMPTZ NOT NULL`  | `DEFAULT now()`.                                                                               |
| `updated_at`           | `TIMESTAMPTZ NOT NULL`  | `DEFAULT now()`.                                                                               |
| `deleted_at`           | `TIMESTAMPTZ NULL`      | Soft delete.                                                                                   |

Indexes:
- `idx_registrations_status` on `(status)` — admin queue filter.
- `idx_registrations_created_at` on `(created_at DESC)` — feed order.
- `idx_registrations_email` on `(email)` — dedup lookup.
- `idx_registrations_komsel_code` on `(komsel_code)` — logical FK → `komsel_locations.code`.

Comments in migration:
- `// logical FK: registrations.komsel_code → komsel_locations.code (service-enforced)`

### Table: `komsel_locations`

Lookup table. Replaces `ENUM` (see AGENTS.md).

| Column       | Type                    | Notes                                                                        |
|--------------|-------------------------|------------------------------------------------------------------------------|
| `id`         | `BIGSERIAL PK`          |                                                                              |
| `code`       | `TEXT NOT NULL`         | Stable key. Service-unique. Values: `jakbar-puri`, `jakpus-menteng`, `jaksel-kemang`, `jaksel-senopati`, `tangerang-bsd`, `online`. |
| `label`      | `TEXT NOT NULL`         | Human name, id-ID. e.g. `Komsel Puri (Jakarta Barat)`.                       |
| `is_active`  | `BOOLEAN NOT NULL`      | `DEFAULT true`. Hide from public form when `false`.                          |
| `sort_order` | `INT NOT NULL`          | `DEFAULT 0`.                                                                 |
| `created_at`, `updated_at`, `deleted_at` | | Standard.                                                            |

Index: `idx_komsel_locations_code` on `(code)`.

Seeded from migration. Editable via admin CMS.

## Duplicate policy

Registration is **not deduped** by email/phone at submit time. A jemaat may submit again if approval slipped or contact changed. Admin sees duplicates in the queue and marks stale ones `rejected` with reason `duplicate`.

Rationale: R19d/R19k — no DB `UNIQUE` on business values; admin owns the decision.

## API

All endpoints Node runtime, JSON, `application/json`. No auth v1 — every endpoint is public. **Admin endpoints below are marked and will gate on auth in Phase 1 later.** Contract shape stays identical.

### `POST /api/registrations` — public submit

Request:

```json
{
  "fullName": "Yohanes Christian Surya",
  "birthDate": "1995-04-12",
  "birthCity": "Bandung",
  "gender": "laki-laki",
  "maritalStatus": "single",
  "phoneWa": "081234567890",
  "email": "yohanes@example.com",
  "address": "Jl. Kemang Raya No. 12, Kel. Bangka, Jakarta Selatan",
  "previousChurch": "GBI Sukawarna",
  "baptismStatus": "sudah",
  "komselCode": "jaksel-kemang",
  "ministryInterests": ["worship", "multimedia"]
}
```

Rules (Zod, see `Contract` below):
- `fullName`: trim, 2..120 chars.
- `birthDate`: valid `YYYY-MM-DD`, not in future, age ≥ 12.
- `birthCity`: trim, 1..80.
- `gender`: `"laki-laki" | "perempuan"`.
- `maritalStatus`: `"single" | "married" | "widowed"`.
- `phoneWa`: matches `^(\+?62|0)8[0-9]{7,12}$` after trim.
- `email`: valid email, lowercased.
- `address`: trim, 5..500.
- `previousChurch`: optional, trim, ≤ 120. `""` becomes `null`.
- `baptismStatus`: `"sudah" | "belum"`.
- `komselCode`: must exist in `komsel_locations` with `is_active = true` (service-checked, not Zod).
- `ministryInterests`: array, each ∈ `{"kids","multimedia","komsel","worship"}`. Max length 4. Duplicates rejected.

Response `201`:

```json
{
  "id": "42",
  "status": "pending",
  "createdAt": "2026-09-07T05:25:22.633Z"
}
```

Errors:
- `400 VALIDATION_ERROR` — Zod fail. `issues[]` populated.
- `400 INVALID_QUERY` — inactive/unknown `komselCode`.
- `422 BUSINESS_RULE_VIOLATION` — age < 12, birthDate in future (redundant with Zod; kept as fallback for cross-field rules like future birthDate detected server-side against `Asia/Jakarta` day boundary).

Never returns previously-submitted registrations. Client must not rely on 409 for duplicates (see policy above).

### `GET /api/registrations` — admin list (currently public v1)

Query:

| Param     | Type                  | Default   | Notes                                              |
|-----------|-----------------------|-----------|----------------------------------------------------|
| `status`  | `pending\|approved\|rejected\|all` | `pending` | Filter.                                            |
| `q`       | `string`              | —         | Case-insensitive match on `full_name` or `email`.  |
| `komsel`  | `string` (code)       | —         | Filter by komsel.                                  |
| `limit`   | `int` 1..100          | `20`      |                                                    |
| `cursor`  | `string`              | —         | Opaque cursor. See architecture.                   |

Sort: `created_at DESC, id DESC`.

Response `200`:

```json
{
  "items": [
    {
      "id": "42",
      "fullName": "Yohanes Christian Surya",
      "email": "yohanes@example.com",
      "phoneWa": "081234567890",
      "komselCode": "jaksel-kemang",
      "komselLabel": "Komsel Kemang (Jakarta Selatan)",
      "status": "pending",
      "createdAt": "2026-09-07T05:25:22.633Z"
    }
  ],
  "nextCursor": "eyJpZCI6IjQyIn0",
  "hasMore": true
}
```

List rows are trimmed — only fields useful in queue view. Detail endpoint returns full record.

### `GET /api/registrations/:id` — admin detail

Response `200` = full DTO (all columns except `deleted_at`, `reviewed_by`), plus derived `komselLabel`.

Errors: `404 NOT_FOUND` if missing or soft-deleted.

### `PATCH /api/registrations/:id` — admin transition

Body:

```json
{
  "status": "approved"
}
```

or:

```json
{
  "status": "rejected",
  "rejectionReason": "Duplikat dari pendaftaran #37"
}
```

Rules:
- Only `pending → approved` or `pending → rejected` allowed.
- `rejected` requires `rejectionReason` (5..500).
- Idempotent: re-PATCH with same status is a no-op returning current state.

Response `200`: full DTO.

Errors:
- `400 VALIDATION_ERROR` — bad body.
- `404 NOT_FOUND`.
- `422 BUSINESS_RULE_VIOLATION` — illegal transition (e.g. `approved → rejected`).

Side effects (deferred to Phase 1 auth): send confirmation email/WhatsApp on approval. Wire hook now, no-op until channel ready.

### `DELETE /api/registrations/:id` — admin soft delete

Sets `deleted_at`. Returns `204`. Idempotent.

### `GET /api/komsel-locations` — public lookup

For the registration form dropdown.

Response `200`:

```json
{
  "items": [
    { "code": "jaksel-kemang", "label": "Komsel Kemang (Jakarta Selatan)" },
    { "code": "online",        "label": "Komsel Online" }
  ]
}
```

Only `is_active = true`, sorted by `sort_order ASC, label ASC`. No cursor — small fixed set.

## Contract (Zod schema)

Location: `src/features/registration/business/schema.ts`.

```ts
import { z } from "zod";

export const GENDERS = ["laki-laki", "perempuan"] as const;
export const MARITAL_STATUSES = ["single", "married", "widowed"] as const;
export const BAPTISM_STATUSES = ["sudah", "belum"] as const;
export const MINISTRY_INTERESTS = ["kids", "multimedia", "komsel", "worship"] as const;
export const REGISTRATION_STATUSES = ["pending", "approved", "rejected"] as const;

const PHONE_WA_RE = /^(\+?62|0)8[0-9]{7,12}$/;
const MIN_AGE = 12;

export const createRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthCity: z.string().trim().min(1).max(80),
  gender: z.enum(GENDERS),
  maritalStatus: z.enum(MARITAL_STATUSES),
  phoneWa: z.string().trim().regex(PHONE_WA_RE),
  email: z.string().trim().toLowerCase().email().max(180),
  address: z.string().trim().min(5).max(500),
  previousChurch: z.string().trim().max(120).optional().nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  baptismStatus: z.enum(BAPTISM_STATUSES),
  komselCode: z.string().trim().min(1).max(40),
  ministryInterests: z.array(z.enum(MINISTRY_INTERESTS)).max(4)
    .refine((a) => new Set(a).size === a.length, "Duplikat pilihan pelayanan"),
}).superRefine((v, ctx) => {
  const d = new Date(`${v.birthDate}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Tanggal lahir tidak valid" });
    return;
  }
  const now = new Date();
  if (d > now) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Tanggal lahir tidak boleh di masa depan" });
  const ageMs = now.getTime() - d.getTime();
  const ageYears = ageMs / (365.25 * 24 * 3600 * 1000);
  if (ageYears < MIN_AGE) ctx.addIssue({ code: "custom", path: ["birthDate"], message: `Usia minimum ${MIN_AGE} tahun` });
});

export const patchRegistrationSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("approved") }),
  z.object({ status: z.literal("rejected"), rejectionReason: z.string().trim().min(5).max(500) }),
]);

export const listRegistrationsQuery = z.object({
  status: z.enum([...REGISTRATION_STATUSES, "all"]).default("pending"),
  q: z.string().trim().max(80).optional(),
  komsel: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
});

export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;
export type PatchRegistrationInput = z.infer<typeof patchRegistrationSchema>;
export type ListRegistrationsQuery = z.infer<typeof listRegistrationsQuery>;
```

## DTOs (wire types)

Location: `src/features/registration/business/dto.ts`. Re-export via `src/features/registration/index.ts`.

```ts
export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface RegistrationListItemDto {
  id: string;
  fullName: string;
  email: string;
  phoneWa: string;
  komselCode: string;
  komselLabel: string;
  status: RegistrationStatus;
  createdAt: string; // ISO 8601
}

export interface RegistrationDetailDto {
  id: string;
  fullName: string;
  birthDate: string;  // YYYY-MM-DD
  birthCity: string;
  gender: "laki-laki" | "perempuan";
  maritalStatus: "single" | "married" | "widowed";
  phoneWa: string;
  email: string;
  address: string;
  previousChurch: string | null;
  baptismStatus: "sudah" | "belum";
  komselCode: string;
  komselLabel: string;
  ministryInterests: Array<"kids" | "multimedia" | "komsel" | "worship">;
  status: RegistrationStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegistrationResponseDto {
  id: string;
  status: "pending";
  createdAt: string;
}

export interface KomselLocationDto {
  code: string;
  label: string;
}
```

## Layer wiring (recap)

- `data/schema.ts` — Drizzle `registrations` + `komsel_locations`.
- `data/registration.repo.ts` — `insert`, `findById`, `list({status, q, komsel, limit, cursor})`, `patchStatus`, `softDelete`.
- `data/komsel-location.repo.ts` — `listActive`, `findByCode`.
- `business/schema.ts` — Zod (above).
- `business/dto.ts` — types (above).
- `business/registration.service.ts` — orchestration:
  - `createRegistration(input)` → validate → check `komselCode` active → insert → return `CreateRegistrationResponseDto`.
  - `listRegistrations(query)` → build cursor filter → repo.list → hydrate `komselLabel` from a single lookup fetch (cached in-request).
  - `getRegistration(id)`.
  - `transitionRegistration(id, patch)` → load → assert `status === "pending"` → repo.patchStatus → return DTO. Emit approval side-effect hook (no-op v1).
  - `deleteRegistration(id)`.
- `business/payload.ts` — pure builder mapping validated input → repo insert args. Referenced by service, kept separate per R23.
- `presentation/registration.controller.ts` — response serializer (row → DTO), issue flattener.
- `app/api/registrations/route.ts` — `GET`, `POST` handlers. `safeParse` at top.
- `app/api/registrations/[id]/route.ts` — `GET`, `PATCH`, `DELETE`.
- `app/api/komsel-locations/route.ts` — `GET`.
- `app/(cms)/registrations/page.tsx` — admin queue.
- `app/(cms)/registrations/[id]/page.tsx` — detail + approve/reject.

## CMS UX (admin)

- Queue page: default filter `status=pending`. Table columns: name, komsel, phone, email, submitted. Row click → detail.
- Detail page: read-only fields + `Approve` (green) / `Reject` (opens reason modal) / `Delete` (confirm). Show status history (created, reviewed).
- Search box: debounced, drives `q`.
- Filter chips: status, komsel.
- Copy is Bahasa Indonesia.

## Mobile UX contract

- Form maps 1:1 to `POST /api/registrations` body. Client renders `komsel-locations` dropdown from `GET /api/komsel-locations`.
- On `201`, mobile shows **"Pendaftaran Terkirim!"** screen. Displays returned `id` (short) as reference number.
- On `400 VALIDATION_ERROR`, mobile maps `issues[].path` → field-level error under each input.
- Ministry interests: multi-select chip group. Empty allowed.

## Migrations

Two migration files (one commit):

1. `NNNN_create_komsel_locations.sql` — table + seed rows for the six initial codes.
2. `NNNN_create_registrations.sql` — table + indexes.

Both reversible (`down` drops table). See `docs/architecture.md` for migration rules.

## Deferred / parked

- Rate limiting on `POST /api/registrations` — add when auth or spam appears.
- Email/WhatsApp notification on approval — hook exists, integration in Phase 1+.
- Export to CSV for admin — add on request.
- Duplicate detection UI (auto-flag repeats by email in queue) — nice-to-have, not blocking.
