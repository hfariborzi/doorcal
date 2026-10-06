"use client";

import { X } from "lucide-react";
import type { TimeRange, WeeklyHours } from "@/db/schema";

export const DAYS = [
  ["7", "Sunday"],
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
] as const;

const TIMES = Array.from({ length: 24 * 4 + 1 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const label = h === 24 ? "12:00 AM (midnight)" : `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return { value, label };
});

export function RangeEditor({ ranges, onChange }: { ranges: TimeRange[]; onChange: (r: TimeRange[]) => void }) {
  return (
    <div className="space-y-2">
      {ranges.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <select className="input w-36 py-1.5" value={r.start} onChange={(e) => onChange(ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}>
            {TIMES.slice(0, -1).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <span className="text-faint">–</span>
          <select className="input w-36 py-1.5" value={r.end} onChange={(e) => onChange(ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}>
            {TIMES.slice(1).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button type="button" className="btn-ghost px-2 py-1" onClick={() => onChange(ranges.filter((_, j) => j !== i))} aria-label="Remove"><X size={16} /></button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm text-accent-soft hover:underline"
        onClick={() => {
          const last = ranges[ranges.length - 1];
          const start = last ? last.end : "09:00";
          const idx = TIMES.findIndex((t) => t.value === start);
          const end = TIMES[Math.min(idx + 4, TIMES.length - 1)].value;
          onChange([...ranges, { start: start === "24:00" ? "23:00" : start, end }]);
        }}
      >
        + Add hours
      </button>
    </div>
  );
}



/** Weekly hours: a toggle per day plus one or more time ranges. Used for availability and for preferred times. */
export function WeeklyHoursEditor({
  weekly,
  onChange,
  offLabel = "Unavailable",
  defaultRange = { start: "09:00", end: "17:00" },
}: {
  weekly: WeeklyHours;
  onChange: (w: WeeklyHours) => void;
  offLabel?: string;
  defaultRange?: TimeRange;
}) {
  return (
    <div className="divide-y divide-line">
      {DAYS.map(([key, label]) => {
        const ranges = weekly[key] ?? [];
        const on = ranges.length > 0;
        return (
          <div key={key} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
            <label className="flex w-36 shrink-0 items-center gap-2 pt-1.5 text-sm font-medium">
              <input type="checkbox" checked={on} onChange={(e) => onChange({ ...weekly, [key]: e.target.checked ? [defaultRange] : [] })} />
              {label}
            </label>
            {on ? (
              <RangeEditor ranges={ranges} onChange={(r) => onChange({ ...weekly, [key]: r })} />
            ) : (
              <span className="pt-1.5 text-sm text-faint">{offLabel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
