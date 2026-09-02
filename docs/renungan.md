# Renungan Harian

Daily devotional module. Admin CRUD via web CMS. Read-heavy consumption by React Native mobile client.

## Data model

Table: `renungan_daily`

| Column          | Type                     | Notes                                                    |
|-----------------|--------------------------|----------------------------------------------------------|
| `id`            | `BIGSERIAL PK`           | Surrogate key.                                           |
| `date`          | `DATE NOT NULL`          | Logical-unique (service-enforced, no DB constraint).     |
| `title`         | `TEXT NOT NULL`          |                                                          |
| `content`       | `TEXT NOT NULL`          |                                                          |
| `scripture_ref` | `TEXT NOT NULL`          | e.g. `"Yohanes 3:16"`, `"1 Korintus 13:4-7"`.            |
| `created_at`    | `TIMESTAMPTZ NOT NULL`   | `DEFAULT now()`.                                         |
| `updated_at`    | `TIMESTAMPTZ NOT NULL`   | `DEFAULT now()`.                                         |
| `deleted_at`    | `TIMESTAMPTZ NULL`       | Soft delete. Queries filter `WHERE deleted_at IS NULL`.  |

Index: `idx_renungan_daily_date` on `(date)`.

## API endpoints

Base: `/api/renungan`. All endpoints Node runtime, JSON, camelCase, ISO 8601 dates (`YYYY-MM-DD`), BigInt ids serialized as strings.

### `GET /api/renungan?month=YYYY-MM`

Returns full array for every day of the month (28-31 items). Missing days are placeholders (`hasContent: false`).

Query param `month` optional; defaults to current UTC month.

Response `200`:

```json
{
  "month": "2026-09",
  "days": [
    {
      "date": "2026-09-01",
      "hasContent": false,
      "imageUrl": "https://picsum.photos/seed/2026-09-01/1200/800",
      "id": null,
      "title": null,
      "content": null,
      "scripture": null
    },
    {
      "date": "2026-09-15",
      "hasContent": true,
      "imageUrl": "https://picsum.photos/seed/2026-09-15/1200/800",
      "id": "1",
      "title": "Kasih Allah",
      "content": "…",
      "scripture": {
        "ref": "Yohanes 3:16",
        "text": "16. Karena Allah sangat mengasihi dunia ini, …",
        "error": null
      }
    }
  ]
}
```

Errors: `400` for bad `month` format.

### `GET /api/renungan/{date}`

Single day. `{date}` is ISO `YYYY-MM-DD`. Returns the same day-entry shape as above (either populated or a `hasContent: false` placeholder).

### `POST /api/renungan`

Create.

Request:
```json
{ "date": "2026-09-15", "title": "Kasih Allah", "content": "…", "scriptureRef": "Yohanes 3:16" }
```

Response `201`: full row (`id`, `date`, `title`, `content`, `scriptureRef`, `createdAt`, `updatedAt`).

Errors: `400` bad input · `409` if a renungan already exists for that date.

### `PUT /api/renungan/{date}`

Update by date. Body may include any of `title`, `content`, `scriptureRef`, `date`. Returns updated row.

Errors: `404` if none · `409` on date collision.

### `DELETE /api/renungan/{date}`

Soft delete. Response `200 { "ok": true }`. `404` if none.

## Scripture lookup

- Source: [AYT (Alkitab Yang Terbuka)](https://api.ayt.co/v1/) — SABDA.
- Endpoint: `GET https://api.ayt.co/v1/bible.php?book=<abbr>&chapter=<n>&source=<domain>`.
- Response is chapter-granularity; verse range is extracted client-side.
- Server accepts full Indonesian names or standard SABDA abbreviations (`Yoh 3:16`, `1 Korintus 13:4-7`). Book map lives in `src/features/renungan/business/scripture-books.ts`.
- Lookup never throws — failures surface as `scripture.error` in the response so a bad ref does not kill the whole month payload.

Env:
```
AYT_API_BASE=https://api.ayt.co/v1
AYT_API_SOURCE=your-registered-domain.example.com
```

## Image service

- `src/shared/services/unsplash-image.ts` returns a deterministic image URL seeded by date.
- Backed by `picsum.photos` (keyless, seeded, no rate limit).
- Client should treat it as ambient art — dimensions default to `1200x800`.
- Same date always yields the same image.
- If real topic/query support is required, swap in the official Unsplash API (needs `UNSPLASH_ACCESS_KEY`).

## Web admin

Route: `/renungan`. Monthly calendar with prev/next arrows. Green dot at top-right of a day cell marks days with content. Click a day → side drawer with create/edit/delete form.

Dashboard (`/`) shows a card with the total number of active renungan.


## Client integration notes

The mobile client consumes the API above. No client-side implementation is documented here — treat the JSON contract as the source of truth.

- `imageUrl` is deterministic per date. Safe to cache aggressively.
- `scripture.text` may be `null` with `scripture.error` populated when the AYT API is unreachable or the reference is malformed. Render a fallback (e.g. the raw `ref`) rather than surfacing the error to end users.
- Days where `hasContent` is `false` should be non-interactive — no dot rendered, tap is a no-op.
- Dates are UTC ISO strings (`YYYY-MM-DD`). If displaying in WIB (`Asia/Jakarta`), format on render only — never mutate the underlying date.
- Auth is not yet wired; a bearer-token header will land in the auth phase.
