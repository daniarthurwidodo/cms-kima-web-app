# Renungan Harian

Daily devotional module. Admin CRUD via web CMS. Read-heavy consumption by Flutter Android client.

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

---

## Flutter implementation

Minimal example — one screen with a calendar and a detail sheet. Uses `http` for network and `table_calendar` for the calendar widget.

`pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.0
  table_calendar: ^3.1.2
  intl: ^0.19.0
```

### Config

```dart
// lib/config.dart
class ApiConfig {
  static const String baseUrl = 'https://your-cms.example.com';
}
```

### Models

```dart
// lib/renungan/models.dart
class ScriptureLookup {
  final String ref;
  final String? text;
  final String? error;
  ScriptureLookup({required this.ref, this.text, this.error});

  factory ScriptureLookup.fromJson(Map<String, dynamic> j) => ScriptureLookup(
        ref: j['ref'] as String,
        text: j['text'] as String?,
        error: j['error'] as String?,
      );
}

class RenunganDay {
  final DateTime date; // UTC midnight
  final bool hasContent;
  final String imageUrl;
  final String? id;
  final String? title;
  final String? content;
  final ScriptureLookup? scripture;

  RenunganDay({
    required this.date,
    required this.hasContent,
    required this.imageUrl,
    this.id,
    this.title,
    this.content,
    this.scripture,
  });

  factory RenunganDay.fromJson(Map<String, dynamic> j) => RenunganDay(
        date: DateTime.parse('${j['date']}T00:00:00Z'),
        hasContent: j['hasContent'] as bool,
        imageUrl: j['imageUrl'] as String,
        id: j['id'] as String?,
        title: j['title'] as String?,
        content: j['content'] as String?,
        scripture: j['scripture'] == null
            ? null
            : ScriptureLookup.fromJson(j['scripture'] as Map<String, dynamic>),
      );
}

class RenunganMonth {
  final String month; // YYYY-MM
  final List<RenunganDay> days;
  RenunganMonth({required this.month, required this.days});

  factory RenunganMonth.fromJson(Map<String, dynamic> j) => RenunganMonth(
        month: j['month'] as String,
        days: (j['days'] as List)
            .map((d) => RenunganDay.fromJson(d as Map<String, dynamic>))
            .toList(),
      );
}
```

### Repository

```dart
// lib/renungan/repository.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import 'models.dart';

class RenunganRepository {
  final http.Client _client;
  RenunganRepository({http.Client? client}) : _client = client ?? http.Client();

  Future<RenunganMonth> fetchMonth(int year, int month) async {
    final monthParam = '$year-${month.toString().padLeft(2, '0')}';
    final uri = Uri.parse('${ApiConfig.baseUrl}/api/renungan?month=$monthParam');
    final res = await _client.get(uri);
    if (res.statusCode != 200) {
      throw Exception('fetchMonth failed: HTTP ${res.statusCode}');
    }
    return RenunganMonth.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<RenunganDay> fetchDay(DateTime date) async {
    final iso = _iso(date);
    final uri = Uri.parse('${ApiConfig.baseUrl}/api/renungan/$iso');
    final res = await _client.get(uri);
    if (res.statusCode != 200) {
      throw Exception('fetchDay failed: HTTP ${res.statusCode}');
    }
    return RenunganDay.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  String _iso(DateTime d) {
    final u = d.toUtc();
    return '${u.year}-${u.month.toString().padLeft(2, '0')}-${u.day.toString().padLeft(2, '0')}';
  }
}
```

### Calendar screen

```dart
// lib/renungan/renungan_calendar_page.dart
import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import 'models.dart';
import 'repository.dart';

class RenunganCalendarPage extends StatefulWidget {
  const RenunganCalendarPage({super.key});
  @override
  State<RenunganCalendarPage> createState() => _RenunganCalendarPageState();
}

class _RenunganCalendarPageState extends State<RenunganCalendarPage> {
  final _repo = RenunganRepository();
  DateTime _focused = DateTime.now().toUtc();
  DateTime? _selected;
  Map<DateTime, RenunganDay> _byDate = {};
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadMonth(_focused);
  }

  Future<void> _loadMonth(DateTime day) async {
    setState(() => _loading = true);
    try {
      final result = await _repo.fetchMonth(day.year, day.month);
      final map = <DateTime, RenunganDay>{
        for (final d in result.days) DateTime.utc(d.date.year, d.date.month, d.date.day): d,
      };
      if (!mounted) return;
      setState(() => _byDate = map);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  RenunganDay? _dayFor(DateTime d) => _byDate[DateTime.utc(d.year, d.month, d.day)];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Renungan Harian')),
      body: Column(
        children: [
          if (_loading) const LinearProgressIndicator(),
          TableCalendar<RenunganDay>(
            firstDay: DateTime.utc(2020, 1, 1),
            lastDay: DateTime.utc(2100, 12, 31),
            focusedDay: _focused,
            selectedDayPredicate: (d) => _selected != null && isSameDay(_selected, d),
            eventLoader: (d) {
              final entry = _dayFor(d);
              return entry != null && entry.hasContent ? [entry] : const [];
            },
            onDaySelected: (selected, focused) {
              setState(() {
                _selected = selected;
                _focused = focused;
              });
              final entry = _dayFor(selected);
              if (entry != null && entry.hasContent) _showDetail(entry);
            },
            onPageChanged: (focused) {
              setState(() => _focused = focused);
              _loadMonth(focused);
            },
            calendarBuilders: CalendarBuilders(
              markerBuilder: (context, day, events) {
                if (events.isEmpty) return null;
                return const Positioned(
                  top: 4,
                  right: 4,
                  child: _GreenDot(),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showDetail(RenunganDay entry) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _RenunganDetailSheet(entry: entry),
    );
  }
}

class _GreenDot extends StatelessWidget {
  const _GreenDot();
  @override
  Widget build(BuildContext context) => Container(
        width: 8,
        height: 8,
        decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle),
      );
}

class _RenunganDetailSheet extends StatelessWidget {
  final RenunganDay entry;
  const _RenunganDetailSheet({required this.entry});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 3 / 2,
              child: Image.network(entry.imageUrl, fit: BoxFit.cover),
            ),
            const SizedBox(height: 12),
            Text(entry.title ?? '', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 4),
            Text(entry.date.toIso8601String().substring(0, 10),
                style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 12),
            if (entry.scripture?.text != null)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(entry.scripture!.ref, style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(entry.scripture!.text!),
                  ],
                ),
              ),
            const SizedBox(height: 16),
            Text(entry.content ?? ''),
          ],
        ),
      ),
    );
  }
}
```

### Notes for the mobile team

- The `imageUrl` is deterministic per date — safe to cache in `cached_network_image` if desired.
- `scripture.text` may be `null` with `scripture.error` populated when the AYT API is unreachable or the reference is malformed. Render a fallback (e.g. the raw `ref` string) rather than surfacing the error to end users.
- `hasContent: false` days should be non-interactive on mobile (calendar dot absent). Only tapping a populated day makes sense.
- Dates come as UTC-midnight ISO strings. If you display in WIB (`Asia/Jakarta`), format on render only — never mutate the underlying date.
- Auth is not yet wired into these endpoints; a bearer-token header will be added once the auth phase lands.
