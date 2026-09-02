"use client";

import { useMemo, useState } from "react";
import { CalendarMonth } from "./CalendarMonth";
import { RenunganForm } from "./RenunganForm";
import { useRenunganMonth } from "./useRenunganMonth";
import type { RenunganDayEntry } from "./types";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
}

export function RenunganCalendarPage() {
  const [month, setMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { data, loading, error, reload } = useRenunganMonth(month);

  const selectedDay: RenunganDayEntry | null = useMemo(() => {
    if (!selectedDate || !data) return null;
    return data.days.find((d) => d.date === selectedDate) ?? null;
  }, [selectedDate, data]);

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Renungan Harian</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              ‹
            </button>
            <span className="min-w-24 text-center text-sm font-medium">{month}</span>
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="rounded border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              ›
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}
        {data && (
          <CalendarMonth
            month={data.month}
            days={data.days}
            selectedDate={selectedDate}
            onSelect={(d) => setSelectedDate(d.date)}
          />
        )}
      </div>

      {selectedDay && (
        <aside className="w-96 shrink-0 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <RenunganForm
            day={selectedDay}
            onSaved={() => {
              void reload();
            }}
            onDeleted={() => {
              setSelectedDate(null);
              void reload();
            }}
            onCancel={() => setSelectedDate(null)}
          />
        </aside>
      )}
    </div>
  );
}
