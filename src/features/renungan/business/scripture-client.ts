import { parseScriptureRef } from "./scripture-books";

const DEFAULT_BASE = "https://api.ayt.co/v1";
const DEFAULT_SOURCE = "kima-cms.local";
const FETCH_TIMEOUT_MS = 5000;

export type ScriptureLookup = {
  ref: string;
  text: string | null;
  error: string | null;
};

type AytVerse = { id: string; verse: string; text: string; title: string };
type AytChapterMap = Record<string, Record<string, AytVerse>>;
type AytBookEntry = { info: { book_abbr: string; book_name: string }; data: AytChapterMap };
type AytResponse = Record<string, AytBookEntry>;

function pickVerses(response: AytResponse, chapter: number, start: number, end: number): string | null {
  const firstBook = Object.values(response)[0];
  if (!firstBook) return null;
  const chapterMap = firstBook.data[String(chapter)];
  if (!chapterMap) return null;
  const verses = Object.values(chapterMap).filter((v) => {
    const n = Number(v.verse);
    return Number.isFinite(n) && n >= start && n <= end;
  });
  if (verses.length === 0) return null;
  return verses.map((v) => `${v.verse}. ${v.text}`).join(" ");
}

// AYT (Alkitab Yang Terbuka) via api.ayt.co. Chapter-granularity endpoint;
// verse range extracted client-side. Never throws — returns error field.
export async function fetchScripture(ref: string): Promise<ScriptureLookup> {
  const parsed = parseScriptureRef(ref);
  if ("error" in parsed) return { ref, text: null, error: parsed.error };

  const base = process.env.AYT_API_BASE ?? DEFAULT_BASE;
  const source = process.env.AYT_API_SOURCE ?? DEFAULT_SOURCE;
  const url = `${base}/bible.php?book=${encodeURIComponent(parsed.bookAbbr)}&chapter=${parsed.chapter}&source=${encodeURIComponent(source)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { ref, text: null, error: `HTTP ${res.status}` };
    const body = (await res.json()) as AytResponse;
    const text = pickVerses(body, parsed.chapter, parsed.verseStart, parsed.verseEnd);
    if (!text) return { ref, text: null, error: `verse(s) not found for "${ref}"` };
    return { ref, text, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return { ref, text: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}
