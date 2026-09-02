// AYT book abbreviations used by api.ayt.co (source: SABDA / AYT).
// Keys are normalized book names (lowercased, whitespace-collapsed).
// Both full Indonesian names and common abbreviations map to the abbrev
// the API expects in the `book` query param.

const BOOK_MAP: Record<string, string> = {
  // Perjanjian Lama
  kejadian: "Kej", kej: "Kej",
  keluaran: "Kel", kel: "Kel",
  imamat: "Im", im: "Im",
  bilangan: "Bil", bil: "Bil",
  ulangan: "Ul", ul: "Ul",
  yosua: "Yos", yos: "Yos",
  "hakim-hakim": "Hak", hakim: "Hak", hak: "Hak",
  rut: "Rut",
  "1 samuel": "1Sam", "1samuel": "1Sam", "1sam": "1Sam",
  "2 samuel": "2Sam", "2samuel": "2Sam", "2sam": "2Sam",
  "1 raja-raja": "1Raj", "1raja-raja": "1Raj", "1raja": "1Raj", "1raj": "1Raj",
  "2 raja-raja": "2Raj", "2raja-raja": "2Raj", "2raja": "2Raj", "2raj": "2Raj",
  "1 tawarikh": "1Taw", "1tawarikh": "1Taw", "1taw": "1Taw",
  "2 tawarikh": "2Taw", "2tawarikh": "2Taw", "2taw": "2Taw",
  ezra: "Ezr", ezr: "Ezr",
  nehemia: "Neh", neh: "Neh",
  ester: "Est", est: "Est",
  ayub: "Ayb", ayb: "Ayb",
  mazmur: "Mzm", mzm: "Mzm",
  amsal: "Ams", ams: "Ams",
  pengkhotbah: "Pkh", pkh: "Pkh",
  "kidung agung": "Kid", kidungagung: "Kid", kid: "Kid",
  yesaya: "Yes", yes: "Yes",
  yeremia: "Yer", yer: "Yer",
  ratapan: "Rat", rat: "Rat",
  yehezkiel: "Yeh", yeh: "Yeh",
  daniel: "Dan", dan: "Dan",
  hosea: "Hos", hos: "Hos",
  yoel: "Yl", yl: "Yl",
  amos: "Am", am: "Am",
  obaja: "Ob", ob: "Ob",
  yunus: "Yun", yun: "Yun",
  mikha: "Mi", mi: "Mi",
  nahum: "Nah", nah: "Nah",
  habakuk: "Hab", hab: "Hab",
  zefanya: "Zef", zef: "Zef",
  hagai: "Hag", hag: "Hag",
  zakharia: "Za", za: "Za",
  maleakhi: "Mal", mal: "Mal",

  // Perjanjian Baru
  matius: "Mat", mat: "Mat",
  markus: "Mrk", mrk: "Mrk", mar: "Mrk",
  lukas: "Luk", luk: "Luk",
  yohanes: "Yoh", yoh: "Yoh",
  "kisah para rasul": "Kis", "kisahpararasul": "Kis", kisah: "Kis", kis: "Kis",
  roma: "Rm", rm: "Rm", rom: "Rm",
  "1 korintus": "1Kor", "1korintus": "1Kor", "1kor": "1Kor",
  "2 korintus": "2Kor", "2korintus": "2Kor", "2kor": "2Kor",
  galatia: "Gal", gal: "Gal",
  efesus: "Ef", ef: "Ef",
  filipi: "Flp", flp: "Flp", fil: "Flp",
  kolose: "Kol", kol: "Kol",
  "1 tesalonika": "1Tes", "1tesalonika": "1Tes", "1tes": "1Tes",
  "2 tesalonika": "2Tes", "2tesalonika": "2Tes", "2tes": "2Tes",
  "1 timotius": "1Tim", "1timotius": "1Tim", "1tim": "1Tim",
  "2 timotius": "2Tim", "2timotius": "2Tim", "2tim": "2Tim",
  titus: "Tit", tit: "Tit",
  filemon: "Flm", flm: "Flm",
  ibrani: "Ibr", ibr: "Ibr",
  yakobus: "Yak", yak: "Yak",
  "1 petrus": "1Ptr", "1petrus": "1Ptr", "1ptr": "1Ptr",
  "2 petrus": "2Ptr", "2petrus": "2Ptr", "2ptr": "2Ptr",
  "1 yohanes": "1Yoh", "1yohanes": "1Yoh", "1yoh": "1Yoh",
  "2 yohanes": "2Yoh", "2yohanes": "2Yoh", "2yoh": "2Yoh",
  "3 yohanes": "3Yoh", "3yohanes": "3Yoh", "3yoh": "3Yoh",
  yudas: "Yud", yud: "Yud",
  wahyu: "Why", why: "Why",
};

export type BookMeta = { name: string; abbr: string };

// Canonical display order (Perjanjian Lama then Perjanjian Baru).
// `name` = full Indonesian name used in composed refs like "Yohanes 3:16".
export const SCRIPTURE_BOOKS: BookMeta[] = [
  { name: "Kejadian", abbr: "Kej" },
  { name: "Keluaran", abbr: "Kel" },
  { name: "Imamat", abbr: "Im" },
  { name: "Bilangan", abbr: "Bil" },
  { name: "Ulangan", abbr: "Ul" },
  { name: "Yosua", abbr: "Yos" },
  { name: "Hakim-hakim", abbr: "Hak" },
  { name: "Rut", abbr: "Rut" },
  { name: "1 Samuel", abbr: "1Sam" },
  { name: "2 Samuel", abbr: "2Sam" },
  { name: "1 Raja-raja", abbr: "1Raj" },
  { name: "2 Raja-raja", abbr: "2Raj" },
  { name: "1 Tawarikh", abbr: "1Taw" },
  { name: "2 Tawarikh", abbr: "2Taw" },
  { name: "Ezra", abbr: "Ezr" },
  { name: "Nehemia", abbr: "Neh" },
  { name: "Ester", abbr: "Est" },
  { name: "Ayub", abbr: "Ayb" },
  { name: "Mazmur", abbr: "Mzm" },
  { name: "Amsal", abbr: "Ams" },
  { name: "Pengkhotbah", abbr: "Pkh" },
  { name: "Kidung Agung", abbr: "Kid" },
  { name: "Yesaya", abbr: "Yes" },
  { name: "Yeremia", abbr: "Yer" },
  { name: "Ratapan", abbr: "Rat" },
  { name: "Yehezkiel", abbr: "Yeh" },
  { name: "Daniel", abbr: "Dan" },
  { name: "Hosea", abbr: "Hos" },
  { name: "Yoel", abbr: "Yl" },
  { name: "Amos", abbr: "Am" },
  { name: "Obaja", abbr: "Ob" },
  { name: "Yunus", abbr: "Yun" },
  { name: "Mikha", abbr: "Mi" },
  { name: "Nahum", abbr: "Nah" },
  { name: "Habakuk", abbr: "Hab" },
  { name: "Zefanya", abbr: "Zef" },
  { name: "Hagai", abbr: "Hag" },
  { name: "Zakharia", abbr: "Za" },
  { name: "Maleakhi", abbr: "Mal" },
  { name: "Matius", abbr: "Mat" },
  { name: "Markus", abbr: "Mrk" },
  { name: "Lukas", abbr: "Luk" },
  { name: "Yohanes", abbr: "Yoh" },
  { name: "Kisah Para Rasul", abbr: "Kis" },
  { name: "Roma", abbr: "Rm" },
  { name: "1 Korintus", abbr: "1Kor" },
  { name: "2 Korintus", abbr: "2Kor" },
  { name: "Galatia", abbr: "Gal" },
  { name: "Efesus", abbr: "Ef" },
  { name: "Filipi", abbr: "Flp" },
  { name: "Kolose", abbr: "Kol" },
  { name: "1 Tesalonika", abbr: "1Tes" },
  { name: "2 Tesalonika", abbr: "2Tes" },
  { name: "1 Timotius", abbr: "1Tim" },
  { name: "2 Timotius", abbr: "2Tim" },
  { name: "Titus", abbr: "Tit" },
  { name: "Filemon", abbr: "Flm" },
  { name: "Ibrani", abbr: "Ibr" },
  { name: "Yakobus", abbr: "Yak" },
  { name: "1 Petrus", abbr: "1Ptr" },
  { name: "2 Petrus", abbr: "2Ptr" },
  { name: "1 Yohanes", abbr: "1Yoh" },
  { name: "2 Yohanes", abbr: "2Yoh" },
  { name: "3 Yohanes", abbr: "3Yoh" },
  { name: "Yudas", abbr: "Yud" },
  { name: "Wahyu", abbr: "Why" },
];

export function composeScriptureRef(bookName: string, chapter: number, verseStart: number, verseEnd?: number | null): string {
  const range = verseEnd && verseEnd > verseStart ? `${verseStart}-${verseEnd}` : `${verseStart}`;
  return `${bookName} ${chapter}:${range}`;
}

function normalizeBookKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function bookNameToAbbr(rawBook: string): string | null {
  const key = normalizeBookKey(rawBook);
  if (BOOK_MAP[key]) return BOOK_MAP[key];
  const collapsed = key.replace(/\s+/g, "");
  return BOOK_MAP[collapsed] ?? null;
}

export type ParsedRef = {
  bookAbbr: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
};

// Accepts: "Yohanes 3:16", "Yoh 3:16", "1 Korintus 13:4-7", "1Kor 13:4-7"
const REF_PATTERN = /^\s*([1-3]?\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\- ]*?)\s+(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?\s*$/;

export function parseScriptureRef(ref: string): ParsedRef | { error: string } {
  if (!ref || typeof ref !== "string") return { error: "reference is required" };
  const match = REF_PATTERN.exec(ref);
  if (!match) return { error: `unrecognized reference: "${ref}"` };
  const bookAbbr = bookNameToAbbr(match[1]);
  if (!bookAbbr) return { error: `unknown book: "${match[1].trim()}"` };
  const chapter = Number(match[2]);
  const verseStart = Number(match[3]);
  const verseEnd = match[4] ? Number(match[4]) : verseStart;
  if (!Number.isFinite(chapter) || chapter < 1) return { error: `bad chapter in "${ref}"` };
  if (!Number.isFinite(verseStart) || verseStart < 1) return { error: `bad verse in "${ref}"` };
  if (verseEnd < verseStart) return { error: `verse range end before start in "${ref}"` };
  return { bookAbbr, chapter, verseStart, verseEnd };
}
