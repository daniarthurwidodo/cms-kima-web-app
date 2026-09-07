# Giving (Persembahan)

Display-only. Mobile shows official bank accounts + optional QRIS per fund. **No transaction flow, no proof upload, no ledger.** Jemaat transfers via their own banking app and (optionally) contacts finance via WhatsApp — link only.

Base path: `/api/giving`.
Feature folder: `src/features/giving/{data,business,presentation}`.

Read `docs/architecture.md` first.

## Scope (locked)

In:
- Fund catalog (Perpuluhan, Building, Social/Kasih, etc.).
- Bank account cards per fund (bank name, account number, account holder).
- Optional QRIS image per fund.
- Optional campaign progress (goal + collected snapshot) for capital-campaign funds.
- Optional WhatsApp confirmation link per fund (or global).

Out (deferred / never):
- Transaction records / donation ledger.
- Proof-of-transfer upload.
- Payment gateway (Midtrans/Xendit/etc.).
- Recurring giving.
- Receipts / tax statements.

Everything below stays feasible without auth.

## Data model

### Table: `giving_funds`

One row per fund shown on the Giving screen.

| Column                | Type                    | Notes                                                                       |
|-----------------------|-------------------------|-----------------------------------------------------------------------------|
| `id`                  | `BIGSERIAL PK`          |                                                                             |
| `code`                | `TEXT NOT NULL`         | Stable key. Service-unique. e.g. `tithe`, `building`, `social`.             |
| `name`                | `TEXT NOT NULL`         | id-ID display. e.g. `Perpuluhan & Umum`.                                    |
| `description`         | `TEXT NULL`             | Short blurb rendered under the title.                                       |
| `accent`              | `TEXT NOT NULL`         | Accent key for UI. Values: `gold`, `emerald`, `crimson`, `royal`. Service-enforced. |
| `qris_image_path`     | `TEXT NULL`             | Supabase Storage path (`giving/qris/…`).                                    |
| `whatsapp_confirm`    | `TEXT NULL`             | Overrides global WA. Full number or `wa.me/…` — client normalizes.          |
| `goal_amount_idr`     | `BIGINT NULL`           | For capital campaigns. Null = no progress bar.                              |
| `collected_amount_idr`| `BIGINT NOT NULL`       | `DEFAULT 0`. Manually updated by admin (snapshot, not a running total).     |
| `is_active`           | `BOOLEAN NOT NULL`      | `DEFAULT true`.                                                             |
| `sort_order`          | `INT NOT NULL`          | `DEFAULT 0`. Card order.                                                    |
| `created_at`, `updated_at`, `deleted_at` | |                                                                          |

Indexes:
- `idx_giving_funds_code` on `(code)`.
- `idx_giving_funds_is_active` on `(is_active)`.

### Table: `giving_fund_accounts`

Bank accounts per fund. One fund → many accounts (e.g. BCA + Mandiri for the same fund).

| Column           | Type                    | Notes                                                                    |
|------------------|-------------------------|--------------------------------------------------------------------------|
| `id`             | `BIGSERIAL PK`          |                                                                          |
| `fund_id`        | `BIGINT NOT NULL`       | Logical FK: `giving_fund_accounts.fund_id → giving_funds.id` (service).  |
| `bank_name`      | `TEXT NOT NULL`         | e.g. `BCA`, `Mandiri`, `BNI`.                                            |
| `bank_logo_path` | `TEXT NULL`             | Supabase Storage path in `public-media/bank-logos/…`.                    |
| `account_number` | `TEXT NOT NULL`         | Stored as-typed (may include spaces/hyphens for readability).            |
| `account_holder` | `TEXT NOT NULL`         | e.g. `GBI Kima Square` or `Yayasan …`.                                   |
| `sort_order`     | `INT NOT NULL`          | `DEFAULT 0`.                                                             |
| `created_at`, `updated_at`, `deleted_at` | |                                                                     |

Indexes:
- `idx_giving_fund_accounts_fund_id` on `(fund_id)`.

Comment in migration:
- `// logical FK: giving_fund_accounts.fund_id → giving_funds.id (service-enforced cascade)`

No separate table for QRIS or campaign progress — kept as columns on `giving_funds` (single-row-per-fund data, YAGNI).

### Global WhatsApp

Falls back to `home_contact_info.whatsapp` (see `docs/home.md`) when `giving_funds.whatsapp_confirm` is null. No new column.

## API

Node runtime, JSON. Public reads open. Admin writes public v1 (auth later).

### `GET /api/giving/funds` — public list

Query:

| Param     | Type      | Default  | Notes                                        |
|-----------|-----------|----------|----------------------------------------------|
| `active`  | `boolean` | `true`   | Admin can pass `false` to see hidden.        |

No pagination. Sort: `sort_order ASC, id ASC`.

Response `200`:

```json
{
  "items": [
    {
      "code": "building",
      "name": "Gedung Baru & Sanctuary",
      "description": "Pembangunan gedung ibadah baru di lokasi utama.",
      "accent": "emerald",
      "qrisImageUrl": "https://…/qris/building.png",
      "whatsappConfirm": "6281234567890",
      "goalAmountIdr": 8500000000,
      "collectedAmountIdr": 2340000000,
      "progressPercent": 27,
      "isActive": true,
      "accounts": [
        {
          "bankName": "BCA",
          "bankLogoUrl": "https://…/bank-logos/bca.png",
          "accountNumber": "123 4567 890",
          "accountHolder": "GBI Kima Square"
        }
      ]
    }
  ]
}
```

Rules:
- `progressPercent` derived server-side: `round(collected / goal * 100)`, clamped `0..100`. `null` when `goalAmountIdr` is null.
- `whatsappConfirm` returns the resolved value (fund-level → global fallback). `null` when neither set.
- Fund with zero accounts still returns (empty `accounts`). Mobile hides the "transfer" section for it.

### `GET /api/giving/funds/:code` — public detail

Same shape as one list item. `404 NOT_FOUND` when missing/inactive/soft-deleted.

### Admin CRUD

- `POST /api/giving/funds` — create fund (without accounts).
- `PATCH /api/giving/funds/:code` — update fund.
- `DELETE /api/giving/funds/:code` — soft delete; cascade soft-delete accounts in same tx.
- `POST /api/giving/funds/:code/accounts` — add account.
- `PATCH /api/giving/funds/:code/accounts/:accountId` — update account.
- `DELETE /api/giving/funds/:code/accounts/:accountId` — soft delete account.

All admin bodies use `Path` for uploads (not URLs).

## Contract (Zod)

Location: `src/features/giving/business/schema.ts`.

```ts
import { z } from "zod";

export const GIVING_ACCENTS = ["gold", "emerald", "crimson", "royal"] as const;
const CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WA_RE = /^(\+?62|0)?8[0-9]{7,12}$/; // stored liberal, client normalizes

export const upsertFundSchema = z.object({
  code: z.string().trim().regex(CODE_RE).min(2).max(40),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  accent: z.enum(GIVING_ACCENTS),
  qrisImagePath: z.string().trim().max(300).optional().nullable(),
  whatsappConfirm: z.string().trim().regex(WA_RE).optional().nullable(),
  goalAmountIdr: z.coerce.number().int().nonnegative().max(1_000_000_000_000).optional().nullable(),
  collectedAmountIdr: z.coerce.number().int().nonnegative().max(1_000_000_000_000).default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
}).superRefine((v, ctx) => {
  if (v.goalAmountIdr != null && v.collectedAmountIdr > v.goalAmountIdr) {
    ctx.addIssue({
      code: "custom",
      path: ["collectedAmountIdr"],
      message: "Jumlah terkumpul tidak boleh melebihi target",
    });
  }
});
export const patchFundSchema = upsertFundSchema.partial();

export const upsertAccountSchema = z.object({
  bankName: z.string().trim().min(2).max(60),
  bankLogoPath: z.string().trim().max(300).optional().nullable(),
  accountNumber: z.string().trim().min(4).max(40),
  accountHolder: z.string().trim().min(2).max(120),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export const patchAccountSchema = upsertAccountSchema.partial();

export const listFundsQuery = z.object({
  active: z.coerce.boolean().default(true),
});
```

## DTOs

Location: `src/features/giving/business/dto.ts`.

```ts
export type GivingAccent = "gold" | "emerald" | "crimson" | "royal";

export interface GivingAccountDto {
  bankName: string;
  bankLogoUrl: string | null;
  accountNumber: string;
  accountHolder: string;
}

export interface GivingFundDto {
  code: string;
  name: string;
  description: string | null;
  accent: GivingAccent;
  qrisImageUrl: string | null;
  whatsappConfirm: string | null;
  goalAmountIdr: number | null;
  collectedAmountIdr: number;
  progressPercent: number | null;
  isActive: boolean;
  accounts: GivingAccountDto[];
}
```

## Money formatting

Server always sends **integer IDR rupiah** (`goalAmountIdr`, `collectedAmountIdr`). Never formatted strings.

Client formats: `Rp 8.500.000.000` (id-ID grouping). Utility lives in mobile client, not server.

Zod cap `1_000_000_000_000` (Rp 1 T) — sanity ceiling. Change when reality demands.

## Service invariants

- `code` service-unique across non-deleted funds. `409 CONFLICT` on collision.
- Deleting a fund cascades soft delete to its accounts in one tx.
- `collectedAmountIdr <= goalAmountIdr` when `goalAmountIdr` set (Zod + service double-check on PATCH).
- Accent must be one of the four accent keys (Zod enum).

## Layer wiring

- `data/schema.ts` — Drizzle `giving_funds`, `giving_fund_accounts`.
- `data/fund.repo.ts`, `data/account.repo.ts` — raw CRUD + join query for list.
- `business/schema.ts`, `business/dto.ts` — above.
- `business/fund.service.ts` — orchestrator: list (join accounts + compute progress + resolve WA fallback), get, create, update, softDelete, addAccount, updateAccount, softDeleteAccount.
- `business/progress.ts` — `computeProgressPercent(collected, goal)` pure helper.
- `business/media-url.ts` — Supabase path → URL (or shared with komsel).
- `presentation/giving.controller.ts` — DTO serializer.
- `app/api/giving/funds/route.ts`, `app/api/giving/funds/[code]/route.ts`, `app/api/giving/funds/[code]/accounts/route.ts`, `app/api/giving/funds/[code]/accounts/[accountId]/route.ts`.
- Admin CMS under `app/(cms)/giving/…`.
- `src/features/giving/index.ts` re-exports:
  - Types `GivingFundDto`, `GivingAccountDto`.
  - No cross-feature service methods needed by others (Home does not embed Giving v1).

## CMS UX

- **Funds list** — table: name, accent chip, goal/collected, active toggle. Row → editor.
- **Fund editor** — form with fields above. QRIS image upload via signed URL. Accounts editor as inline list with add/remove/reorder.
- **WhatsApp confirm** — text field with placeholder note "Kosongkan untuk pakai kontak global gereja."
- **Progress** — two numeric inputs; server rejects `collected > goal`; UI shows preview `%`.

## Mobile UX contract

- Giving tab → single `GET /api/giving/funds`.
- Render one card per fund with accent color, name, description, progress bar (if `progressPercent != null`), account list (bank logo + number + holder + copy button), QRIS image (if present, opens larger view).
- WhatsApp button → `https://wa.me/{normalized(whatsappConfirm)}` prefilled with text `Halo, saya ingin konfirmasi persembahan untuk {fund.name}.`.
- Copy account number → toast `Nomor rekening disalin`.
- No form submission, no upload, no signed URL fetch.

## Migrations

1. `NNNN_create_giving_funds.sql` — funds + indexes + seed three initial rows:
   - `tithe` — Perpuluhan & Umum · accent `gold`.
   - `building` — Gedung Baru & Sanctuary · accent `emerald` · optional goal.
   - `social` — Kasih Jemaat Sesama · accent `crimson`.
2. `NNNN_create_giving_fund_accounts.sql` — accounts + indexes. No seed (admin fills via CMS).

Both reversible.

## Deferred / parked

- Transaction ledger (would need auth + payment gateway).
- QR code auto-generation (server-side). v1 = admin uploads a static QRIS image.
- Anonymized recent-giving ticker.
- Per-fund campaign timeline / milestones.
- Multi-currency (unlikely — id-ID only).
