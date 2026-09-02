import { strict as assert } from "node:assert";
import { buildMonthRange, daysInMonth, parseMonthParam } from "./month";
import { assertIsoDate, buildRenunganInsert } from "./payload-builder";
import { bookNameToAbbr, parseScriptureRef } from "./scripture-books";
import { getSeededImageUrl } from "@/src/shared/services/unsplash-image";

// Run: npx tsx src/features/renungan/business/__check.ts

assert.equal(daysInMonth(2024, 2), 29, "2024 Feb is leap");
assert.equal(daysInMonth(2025, 2), 28, "2025 Feb is 28");
assert.equal(daysInMonth(2026, 9), 30, "Sep is 30");

const range = buildMonthRange(2026, 9);
assert.equal(range.days.length, 30);
assert.equal(range.start, "2026-09-01");
assert.equal(range.end, "2026-09-30");

assert.deepEqual(parseMonthParam("2026-09"), { year: 2026, month: 9 });
assert.throws(() => parseMonthParam("2026-13"));
assert.throws(() => parseMonthParam("bogus"));

assert.equal(assertIsoDate("2026-09-15"), "2026-09-15");
assert.throws(() => assertIsoDate("2026-02-30"));
assert.throws(() => assertIsoDate("26-9-1"));

const insert = buildRenunganInsert({
  date: "2026-09-15",
  title: "  Kasih  ",
  content: "Isi renungan",
  scriptureRef: "Yohanes 3:16",
});
assert.equal(insert.title, "Kasih");
assert.equal(insert.date, "2026-09-15");

assert.throws(() => buildRenunganInsert({ date: "2026-09-15", title: "", content: "x", scriptureRef: "y" }));

const url = getSeededImageUrl("2026-09-15");
assert.match(url, /picsum\.photos\/seed\/2026-09-15\/\d+\/\d+/);

assert.equal(bookNameToAbbr("Yohanes"), "Yoh");
assert.equal(bookNameToAbbr("yohanes"), "Yoh");
assert.equal(bookNameToAbbr("1 Korintus"), "1Kor");
assert.equal(bookNameToAbbr("1kor"), "1Kor");
assert.equal(bookNameToAbbr("Wahyu"), "Why");
assert.equal(bookNameToAbbr("blabla"), null);

const p1 = parseScriptureRef("Yohanes 3:16");
assert.deepEqual(p1, { bookAbbr: "Yoh", chapter: 3, verseStart: 16, verseEnd: 16 });
const p2 = parseScriptureRef("1 Korintus 13:4-7");
assert.deepEqual(p2, { bookAbbr: "1Kor", chapter: 13, verseStart: 4, verseEnd: 7 });
const p3 = parseScriptureRef("Yoh 3:16");
assert.deepEqual(p3, { bookAbbr: "Yoh", chapter: 3, verseStart: 16, verseEnd: 16 });
const p4 = parseScriptureRef("bogus");
assert.ok("error" in p4);

console.log("OK");
