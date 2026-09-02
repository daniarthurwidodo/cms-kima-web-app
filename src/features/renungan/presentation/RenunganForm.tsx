"use client";

import { useEffect, useState } from "react";
import type { RenunganDayEntry, RenunganFormState } from "./types";

type Props = {
  day: RenunganDayEntry;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
};

const EMPTY: RenunganFormState = { title: "", content: "", scriptureRef: "" };

function buildInitial(day: RenunganDayEntry): RenunganFormState {
  if (!day.hasContent) return EMPTY;
  return {
    title: day.title ?? "",
    content: day.content ?? "",
    scriptureRef: day.scripture?.ref ?? "",
  };
}

async function submitRenungan(day: RenunganDayEntry, form: RenunganFormState): Promise<void> {
  const isUpdate = day.hasContent;
  const url = isUpdate ? `/api/renungan/${day.date}` : `/api/renungan`;
  const method = isUpdate ? "PUT" : "POST";
  const payload = isUpdate ? form : { ...form, date: day.date };
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

async function deleteRenungan(date: string): Promise<void> {
  const res = await fetch(`/api/renungan/${date}`, { method: "DELETE" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

export function RenunganForm({ day, onSaved, onDeleted, onCancel }: Props) {
  const [form, setForm] = useState<RenunganFormState>(() => buildInitial(day));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(buildInitial(day));
    setError(null);
  }, [day]);

  const isUpdate = day.hasContent;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await submitRenungan(day, form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setError(null);
    try {
      await deleteRenungan(day.date);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{day.date}</h2>
        <button type="button" onClick={onCancel} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          Close
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Title</span>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Scripture reference</span>
        <input
          value={form.scriptureRef}
          onChange={(e) => setForm({ ...form, scriptureRef: e.target.value })}
          placeholder="Yohanes 3:16"
          required
          className="rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">Content</span>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          required
          rows={10}
          className="flex-1 rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
