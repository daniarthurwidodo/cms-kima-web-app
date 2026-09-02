"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [drawerDay, setDrawerDay] = useState<RenunganDayEntry | null>(null);
  const { data, loading, error, reload } = useRenunganMonth(month);

  const currentDay: RenunganDayEntry | null = useMemo(() => {
    if (!selectedDate || !data) return null;
    return data.days.find((d) => d.date === selectedDate) ?? null;
  }, [selectedDate, data]);

  // Keep drawer content mounted during exit animation.
  useEffect(() => {
    if (currentDay) setDrawerDay(currentDay);
  }, [currentDay]);

  const isOpen = Boolean(currentDay);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedDate(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <div>
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

      {/* Backdrop */}
      <div
        onClick={() => setSelectedDate(null)}
        aria-hidden={!isOpen}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform overflow-y-auto border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-900 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {drawerDay && (
          <div className="h-full p-6">
            <RenunganForm
              day={drawerDay}
              onSaved={() => {
                void reload();
              }}
              onDeleted={() => {
                setSelectedDate(null);
                void reload();
              }}
              onCancel={() => setSelectedDate(null)}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
