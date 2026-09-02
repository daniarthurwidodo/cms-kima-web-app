"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SCRIPTURE_BOOKS,
  composeScriptureRef,
  parseScriptureRef,
  bookNameToAbbr,
} from "@/src/features/renungan/business/scripture-books";
import {
  flattenIssues,
  renunganFormSchema,
  type FieldErrors,
  type RenunganFormInput,
} from "./formSchema";
import type { RenunganDayEntry } from "./types";

type Props = {
  day: RenunganDayEntry;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
};

const DEFAULT_BOOK = SCRIPTURE_BOOKS[0].name;

const EMPTY: RenunganFormInput = {
  title: "",
  content: "",
  bookName: DEFAULT_BOOK,
  chapter: "",
  verseStart: "",
  verseEnd: "",
};

function bookNameFromRef(rawRef: string): string {
  const parsed = parseScriptureRef(rawRef);
  if ("error" in parsed) return DEFAULT_BOOK;
  const match = SCRIPTURE_BOOKS.find((b) => bookNameToAbbr(b.name) === parsed.bookAbbr);
  return match?.name ?? DEFAULT_BOOK;
}

function buildInitial(day: RenunganDayEntry): RenunganFormInput {
  if (!day.hasContent) return EMPTY;
  const rawRef = day.scripture?.ref ?? "";
  const parsed = parseScriptureRef(rawRef);
  const base = {
    title: day.title ?? "",
    content: day.content ?? "",
    bookName: DEFAULT_BOOK,
    chapter: "",
    verseStart: "",
    verseEnd: "",
  } satisfies RenunganFormInput;
  if ("error" in parsed) return base;
  return {
    ...base,
    bookName: bookNameFromRef(rawRef),
    chapter: String(parsed.chapter),
    verseStart: String(parsed.verseStart),
    verseEnd: String(parsed.verseEnd),
  };
}

async function submitRenungan(
  day: RenunganDayEntry,
  payload: { title: string; content: string; scriptureRef: string },
): Promise<void> {
  const isUpdate = day.hasContent;
  const url = isUpdate ? `/api/renungan/${day.date}` : `/api/renungan`;
  const method = isUpdate ? "PUT" : "POST";
  const body = isUpdate ? payload : { ...payload, date: day.date };
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error ?? `HTTP ${res.status}`);
  }
}

async function deleteRenungan(date: string): Promise<void> {
  const res = await fetch(`/api/renungan/${date}`, { method: "DELETE" });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error ?? `HTTP ${res.status}`);
  }
}

export function RenunganForm({ day, onSaved, onDeleted, onCancel }: Props) {
  const [form, setForm] = useState<RenunganFormInput>(() => buildInitial(day));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildInitial(day));
    setFieldErrors({});
    setSubmitError(null);
  }, [day]);

  const previewRef = useMemo(() => {
    const parsed = renunganFormSchema.safeParse(form);
    if (!parsed.success) return "";
    const { bookName, chapter, verseStart, verseEnd } = parsed.data;
    return composeScriptureRef(bookName, chapter, verseStart, verseEnd);
  }, [form]);

  const isUpdate = day.hasContent;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = renunganFormSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(flattenIssues(parsed.error));
      setSubmitError(null);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setSubmitError(null);
    try {
      const { title, content, bookName, chapter, verseStart, verseEnd } = parsed.data;
      const scriptureRef = composeScriptureRef(bookName, chapter, verseStart, verseEnd);
      await submitRenungan(day, { title, content, scriptureRef });
      onSaved();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setSubmitError(null);
    try {
      await deleteRenungan(day.date);
      onDeleted();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
  const errorClass = "text-xs text-red-600";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{day.date}</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Close
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Title</span>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className={inputClass}
        />
        {fieldErrors.title && <span className={errorClass}>{fieldErrors.title}</span>}
      </label>

      <fieldset className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1 text-sm font-medium">Scripture</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>Book</span>
          <select
            value={form.bookName}
            onChange={(e) => setForm({ ...form, bookName: e.target.value })}
            className={inputClass}
          >
            {SCRIPTURE_BOOKS.map((b) => (
              <option key={b.abbr} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
          {fieldErrors.bookName && <span className={errorClass}>{fieldErrors.bookName}</span>}
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Chapter</span>
            <input
              type="number"
              min={1}
              value={form.chapter}
              onChange={(e) => setForm({ ...form, chapter: e.target.value })}
              className={inputClass}
            />
            {fieldErrors.chapter && <span className={errorClass}>{fieldErrors.chapter}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Verse</span>
            <input
              type="number"
              min={1}
              value={form.verseStart}
              onChange={(e) => setForm({ ...form, verseStart: e.target.value })}
              className={inputClass}
            />
            {fieldErrors.verseStart && <span className={errorClass}>{fieldErrors.verseStart}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>To verse</span>
            <input
              type="number"
              min={1}
              value={form.verseEnd}
              onChange={(e) => setForm({ ...form, verseEnd: e.target.value })}
              className={inputClass}
            />
            {fieldErrors.verseEnd && <span className={errorClass}>{fieldErrors.verseEnd}</span>}
          </label>
        </div>
        {previewRef && (
          <p className="text-xs text-zinc-500">
            Ref: <span className="font-mono">{previewRef}</span>
          </p>
        )}
      </fieldset>

      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">Content</span>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          rows={10}
          className={`flex-1 ${inputClass}`}
        />
        {fieldErrors.content && <span className={errorClass}>{fieldErrors.content}</span>}
      </label>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <div className="flex items-center justify-between">
        {isUpdate ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="rounded border border-red-500 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "Saving…" : isUpdate ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
