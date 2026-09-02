"use client";

import type { RenunganDayEntry } from "./types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  month: string;
  days: RenunganDayEntry[];
  selectedDate: string | null;
  onSelect: (day: RenunganDayEntry) => void;
};

function leadingBlankCount(firstDateIso: string): number {
  const [y, m, d] = firstDateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function CalendarMonth({ month, days, selectedDate, onSelect }: Props) {
  if (days.length === 0) return null;
  const blanks = leadingBlankCount(days[0].date);
  const cells: (RenunganDayEntry | null)[] = [
    ...Array.from({ length: blanks }, () => null),
    ...days,
  ];

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-medium text-zinc-500">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((day, idx) => {
          if (!day) return <div key={`blank-${idx}`} />;
          const dayNum = Number(day.date.slice(-2));
          const isSelected = day.date === selectedDate;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelect(day)}
              className={`relative flex aspect-square items-center justify-center rounded border p-2 text-sm transition ${
                isSelected
                  ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                  : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              }`}
              aria-label={`${day.date}${day.hasContent ? " (has renungan)" : ""}`}
            >
              <span>{dayNum}</span>
              {day.hasContent && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>
      <p className="sr-only">Month {month}</p>
    </div>
  );
}
