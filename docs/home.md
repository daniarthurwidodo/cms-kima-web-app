# Home (Beranda)

Aggregator screen for the mobile app. Single endpoint composes several features into one payload so the mobile client hits Home once on open.

Base path: `/api/home`.
Feature folder: `src/features/home/{business,presentation}` — **no `data/` layer**. Home owns no tables; it orchestrates other features' services.

Read `docs/architecture.md` first.

## Screen sections (from Stitch)

1. **Live Broadcast ribbon** — current or next livestream.
2. **Hero sermon of the week** — headline sermon (e.g. `"Hidup dalam Perkenanan Tuhan"`).
3. **Registration CTA banner** — deep-link to registration form.
4. **Warta Jemaat & Acara** — horizontal carousel of announcements/events.
5. **Santapan Rohani Hari Ini** — today's renungan.
6. **Ulang Tahun Hari Ini** — birthdays today (approved jemaat only).
7. **Hubungi Kami & Lokasi Ibadah** — static-ish contact + service locations.

Every section is optional in the response — Home degrades gracefully. Mobile hides sections whose array/object is empty/null.

## Data sources (per section)

| Section         | Source feature                       | Notes                                                                                   |
|-----------------|--------------------------------------|-----------------------------------------------------------------------------------------|
| `liveBroadcast` | `sermons` (Phase 6)                  | Nearest livestream in a ±3h window. Null when nothing live.                             |
| `heroSermon`    | `sermons` (Phase 6)                  | Flag `is_hero = true` on one row; service picks most recent with flag.                  |
| `registrationCta` | `registration`                     | Static id-ID copy in code, hard-coded here. No DB.                                      |
| `warta`         | `warta` (owned inline in this doc)   | Latest N announcements. New table: `warta` (below).                                     |
| `todayRenungan` | `renungan` (existing)                | Reuses `renunganRepo.findByDate(today)`. Date resolved in `Asia/Jakarta`.               |
| `birthdays`     | `registration`                       | `registrations` where `status = approved`, month/day of `birth_date` = today (WIB).     |
| `contact`       | `home` config table                  | New table: `home_contact_info` (single row, service enforced).                          |

## New tables owned by Home

Only content that has no natural home elsewhere. Everything else is a cross-feature read.

### Table: `warta`

Church-wide announcements + events. Small, carousel-driven — separate feature would be over-scoped for v1.

| Column         | Type                    | Notes                                                                    |
|----------------|-------------------------|--------------------------------------------------------------------------|
| `id`           | `BIGSERIAL PK`          |                                                                          |
| `title`        | `TEXT NOT NULL`         |                                                                          |
| `subtitle`     | `TEXT NULL`             | Short caption under title.                                               |
| `image_path`   | `TEXT NULL`             | Supabase Storage path in `public-media`. Client builds full URL.         |
| `event_date`   | `DATE NULL`             | For events. Null for pure announcements.                                 |
| `published_at` | `TIMESTAMPTZ NOT NULL`  | Client filter `published_at <= now()`.                                   |
| `expires_at`   | `TIMESTAMPTZ NULL`      | Auto-hide after this. Null = evergreen.                                  |
| `sort_order`   | `INT NOT NULL`          | `DEFAULT 0`. Higher shows first within same publish window.              |
| `created_at`, `updated_at`, `deleted_at` | |                                                                        |

Indexes:
- `idx_warta_published_at` on `(published_at DESC)`.
- `idx_warta_expires_at` on `(expires_at)`.

### Table: `home_contact_info`

Single-row table. Service asserts exactly one active row.

| Column               | Type                    | Notes                                             |
|----------------------|-------------------------|---------------------------------------------------|
| `id`                 | `BIGSERIAL PK`          |                                                   |
| `phone`              | `TEXT NULL`             | Display + `tel:` link.                            |
| `whatsapp`           | `TEXT NULL`             | Phone or invite link.                             |
| `email`              | `TEXT NULL`             |                                                   |
| `instagram_handle`   | `TEXT NULL`             |                                                   |
| `youtube_channel_id` | `TEXT NULL`             | For live embed.                                   |
| `service_locations`  | `JSONB NOT NULL`        | Array of `{name, address, mapUrl, times[]}`.      |
| `updated_at`, `created_at` | | No soft delete (single row).                                            |

`service_locations` shape:

```json
[
  {
    "name": "GBI Kima Square Utama",
    "address": "Jl. …, Jakarta",
    "mapUrl": "https://maps.google.com/…",
    "times": [
      { "day": "sunday", "time": "07:30", "labelId": "Ibadah Umum I" },
      { "day": "sunday", "time": "10:00", "labelId": "Ibadah Umum II" }
    ]
  }
]
```

`day` values: `sunday|monday|tuesday|wednesday|thursday|friday|saturday`.

## API

### `GET /api/home` — public aggregator

Query:

| Param     | Type       | Default              | Notes                                                                            |
|-----------|------------|----------------------|----------------------------------------------------------------------------------|
| `date`    | `YYYY-MM-DD` | server day (WIB)   | Override "today" for testing/preview. Never trust client date for real behavior. |
| `wartaLimit` | `int` 1..20 | `10`              | Warta carousel size.                                                             |
| `birthdayLimit` | `int` 1..50 | `20`            | Birthdays cap.                                                                   |

Runtime: Node. Cache: `Cache-Control: public, max-age=60, s-maxage=60`. Home changes slowly — 60s edge cache is fine. Live broadcast section may lag by ≤60s (acceptable).

Response `200` (`HomeDto`):

```json
{
  "date": "2026-09-07",
  "liveBroadcast": {
    "youtubeId": "dQw4w9WgXcQ",
    "title": "Ibadah Minggu Live",
    "startAt": "2026-09-07T02:30:00.000Z",
    "endAt": "2026-09-07T05:00:00.000Z",
    "isLive": true
  },
  "heroSermon": {
    "id": "88",
    "title": "Hidup dalam Perkenanan Tuhan",
    "speaker": "Pdt. Andreas Wijaya",
    "youtubeId": "abc123XYZ00",
    "thumbnailUrl": "https://…/thumb.jpg",
    "publishedAt": "2026-09-01T09:00:00.000Z"
  },
  "registrationCta": {
    "title": "Gabung Keluarga GBI Kima Square",
    "subtitle": "Daftar sebagai jemaat baru dalam 3 menit",
    "actionPath": "/registration"
  },
  "warta": {
    "items": [
      {
        "id": "12",
        "title": "Ibadah Paskah 2026: Hidup Berkemenangan",
        "subtitle": "Minggu, 5 April · 07:30 WIB",
        "imageUrl": "https://…/warta/2026/03/xyz.jpg",
        "eventDate": "2026-04-05",
        "publishedAt": "2026-03-20T00:00:00.000Z"
      }
    ]
  },
  "todayRenungan": {
    "date": "2026-09-07",
    "title": "Damai Sejahtera Melampaui Segala Akal",
    "scriptureRef": "Filipi 4:6-7",
    "excerpt": "…first ~180 chars of content…",
    "hasContent": true
  },
  "birthdays": {
    "items": [
      { "displayName": "Clara Stephany" },
      { "displayName": "Bpk. Hendra Gunawan" }
    ]
  },
  "contact": {
    "phone": "+62 21 5678 1234",
    "whatsapp": "+62 812 3456 7890",
    "email": "hello@gbikima.church",
    "instagramHandle": "gbikimasquare",
    "youtubeChannelId": "UCxxxxxxxxxx",
    "serviceLocations": [
      {
        "name": "GBI Kima Square Utama",
        "address": "Jl. …, Jakarta",
        "mapUrl": "https://maps.google.com/…",
        "times": [
          { "day": "sunday", "time": "07:30", "labelId": "Ibadah Umum I" }
        ]
      }
    ]
  }
}
```

Rules:
- Any section with no data → the key is `null` (object sections) or `{ "items": [] }` (list sections). Never omit the key — mobile decodes a stable shape.
- `todayRenungan.excerpt` is server-truncated at 180 chars, no HTML.
- `birthdays.items[].displayName` is derived from `full_name` with an honorific prefix rule (see below). No email, no phone, no id — public data hygiene.
- `heroSermon` and `liveBroadcast` return `null` when Phase 6 not shipped. Mobile handles both null.

Errors:
- `400 INVALID_QUERY` — bad date/limit.
- `500 INTERNAL_ERROR` — orchestration failed. Home is best-effort: **service must catch per-section failures and null-out that section rather than 500 the whole response** (guard rail below).

### Birthday name rule

- `marital_status = "married"` and `gender = "laki-laki"` → `"Bpk. {FirstNameLast}"`.
- `marital_status = "married"` and `gender = "perempuan"` → `"Ibu {FirstNameLast}"`.
- Otherwise → `{FirstName} {LastNameInitial}.` (e.g. `"Clara S."`).

`FirstNameLast` = first token + last token of `full_name`. Deterministic, done in service.

### Admin endpoints (warta + contact)

`GET /api/warta` — admin list (all, incl. unpublished/expired).

```
?status=published|scheduled|expired|all  (default: all)
&q=<search>
&limit=20&cursor=…
```

`POST /api/warta` — create.
`GET /api/warta/:id` — detail.
`PATCH /api/warta/:id` — update.
`DELETE /api/warta/:id` — soft delete.

Body (create/update):

```json
{
  "title": "…",
  "subtitle": "…",
  "imagePath": "warta/2026/03/xyz.jpg",
  "eventDate": "2026-04-05",
  "publishedAt": "2026-03-20T00:00:00.000Z",
  "expiresAt": null,
  "sortOrder": 0
}
```

`GET /api/home/contact` — public read of `home_contact_info`.
`PUT /api/home/contact` — admin replace (single row upsert).

## Contract (Zod)

Location: `src/features/home/business/schema.ts`.

```ts
import { z } from "zod";

export const homeQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  wartaLimit: z.coerce.number().int().min(1).max(20).default(10),
  birthdayLimit: z.coerce.number().int().min(1).max(50).default(20),
});
export type HomeQuery = z.infer<typeof homeQuerySchema>;

export const createWartaSchema = z.object({
  title: z.string().trim().min(2).max(160),
  subtitle: z.string().trim().max(200).optional().nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  imagePath: z.string().trim().max(300).optional().nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  publishedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export const patchWartaSchema = createWartaSchema.partial();

export const serviceTimeSchema = z.object({
  day: z.enum(["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  labelId: z.string().trim().min(1).max(80),
});
export const serviceLocationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(500),
  mapUrl: z.string().url().max(500),
  times: z.array(serviceTimeSchema).min(1),
});
export const putContactSchema = z.object({
  phone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().toLowerCase().email().max(180).optional().nullable(),
  instagramHandle: z.string().trim().max(60).optional().nullable(),
  youtubeChannelId: z.string().trim().regex(/^UC[a-zA-Z0-9_-]{22}$/).optional().nullable(),
  serviceLocations: z.array(serviceLocationSchema),
});
```

## DTOs

Location: `src/features/home/business/dto.ts`.

```ts
export interface LiveBroadcastDto {
  youtubeId: string;
  title: string;
  startAt: string;
  endAt: string;
  isLive: boolean;
}

export interface HeroSermonDto {
  id: string;
  title: string;
  speaker: string;
  youtubeId: string;
  thumbnailUrl: string | null;
  publishedAt: string;
}

export interface RegistrationCtaDto {
  title: string;
  subtitle: string;
  actionPath: string;
}

export interface WartaItemDto {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  eventDate: string | null;
  publishedAt: string;
}

export interface TodayRenunganDto {
  date: string;
  title: string;
  scriptureRef: string;
  excerpt: string;
  hasContent: boolean;
}

export interface BirthdayItemDto {
  displayName: string;
}

export interface ServiceTimeDto { day: string; time: string; labelId: string; }
export interface ServiceLocationDto { name: string; address: string; mapUrl: string; times: ServiceTimeDto[]; }
export interface ContactDto {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagramHandle: string | null;
  youtubeChannelId: string | null;
  serviceLocations: ServiceLocationDto[];
}

export interface HomeDto {
  date: string;
  liveBroadcast: LiveBroadcastDto | null;
  heroSermon: HeroSermonDto | null;
  registrationCta: RegistrationCtaDto;
  warta: { items: WartaItemDto[] };
  todayRenungan: TodayRenunganDto | null;
  birthdays: { items: BirthdayItemDto[] };
  contact: ContactDto | null;
}
```

## Service orchestration

Location: `src/features/home/business/home.service.ts`.

```ts
export async function getHome(query: HomeQuery): Promise<HomeDto> {
  const date = query.date ?? todayInJakarta();
  const [live, hero, warta, renungan, birthdays, contact] = await Promise.all([
    safe(() => sermonsService.getLiveBroadcast()),
    safe(() => sermonsService.getHeroSermon()),
    safe(() => wartaService.listActive({ limit: query.wartaLimit, at: new Date() })),
    safe(() => renunganService.getByDate(date)),
    safe(() => registrationService.listBirthdays({ date, limit: query.birthdayLimit })),
    safe(() => contactService.get()),
  ]);
  return {
    date,
    liveBroadcast: live ?? null,
    heroSermon: hero ?? null,
    registrationCta: REGISTRATION_CTA_STATIC,
    warta: { items: warta ?? [] },
    todayRenungan: renungan ?? null,
    birthdays: { items: birthdays ?? [] },
    contact: contact ?? null,
  };
}
```

- `safe(fn)` wraps and logs per-section failures. Never rethrows into the aggregator. See guard rail above.
- Fan-out is bounded (6 calls) → `Promise.all` is OK per R17a exception.
- `todayInJakarta()` computes date in `Asia/Jakarta` — never `new Date().toISOString().slice(0,10)`.

`REGISTRATION_CTA_STATIC` is a module-level const with the id-ID copy — no config table for a value that never changes (KISS).

## Layer wiring

- `business/home.service.ts` — orchestration + `safe` wrapper.
- `business/constants.ts` — `REGISTRATION_CTA_STATIC`, section keys.
- `business/schema.ts` — Zod above.
- `business/dto.ts` — types above.
- `business/warta.service.ts` + `data/warta.repo.ts` + `data/schema.ts` — warta CRUD.
- `business/contact.service.ts` + `data/contact.repo.ts` — single-row upsert.
- `business/birthday.query.ts` — reads from `registrationService` (cross-feature via its `index.ts`). Does not read `registrations` directly.
- `presentation/home.controller.ts` — DTO serializers.
- `app/api/home/route.ts` — `GET`.
- `app/api/home/contact/route.ts` — `GET`, `PUT`.
- `app/api/warta/route.ts` — `GET`, `POST`.
- `app/api/warta/[id]/route.ts` — `GET`, `PATCH`, `DELETE`.
- `app/(cms)/warta/…` — admin CRUD screens.
- `app/(cms)/settings/contact/page.tsx` — contact editor.

## CMS UX

- **Warta CRUD** — list with status chips (Published / Scheduled / Expired). Image upload via signed URL. Publish datetime picker. Expiry optional.
- **Contact settings** — single form. Add/remove service locations dynamically. Days as pill selector, time as `HH:mm` picker.
- **Home preview** (nice-to-have, deferred) — read-only render of `GET /api/home` inside CMS.

## Mobile UX contract

- Single fetch on Home tab open. Sections rendered top-down in the order shown above.
- `isLive` drives the pulse dot on the live ribbon.
- Warta carousel: horizontal snap. Tap → external event page (later phase) or no-op v1.
- Today renungan: tap → renungan detail (`/renungan/:date`).
- Birthdays: read-only chips. No tap action v1.
- Contact: tap phone → dialer, tap WA → `wa.me`, tap map → maps intent.

## Cross-feature import rules

Home consumes:
- `renungan/index.ts` — must export `getByDate(date: string): Promise<TodayRenunganDto | null>`.
- `registration/index.ts` — must export `listBirthdays({ date, limit }): Promise<BirthdayItemDto[]>`.
- `sermons/index.ts` — must export `getLiveBroadcast()`, `getHeroSermon()` (Phase 6).

Deep imports across features are banned (see AGENTS.md). Any missing export is a blocking gap for Home.

## Migrations

Two files:
1. `NNNN_create_warta.sql` — table + indexes.
2. `NNNN_create_home_contact_info.sql` — table + seed with one empty row so `GET /api/home/contact` never 404s.

Both reversible.

## Deferred / parked

- Personalized greetings by name (needs auth).
- Push notification "Renungan sudah tersedia" (Phase 6+ with FCM).
- Deep-link into warta detail (Phase 4+ when warta grows to full CRUD screens for members).
- Live broadcast auto-refresh (client-side WebSocket) — v1 uses 60s polling.
- CDN preview cache invalidation on warta publish — v1 relies on 60s TTL.
