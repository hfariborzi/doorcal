"use client";

import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DateOverride, TimeRange, WeeklyHours } from "@/db/schema";
import { saveSchedule } from "../actions";
import { TimezoneOptions } from "@/components/TimezoneOptions";

const DAYS = [
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

function RangeEditor({ ranges, onChange }: { ranges: TimeRange[]; onChange: (r: TimeRange[]) => void }) {
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


export function ScheduleForm({
  initial,
}: {
  initial: { id?: number; name: string; timezone: string; weekly: WeeklyHours; overrides: DateOverride[] };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [weekly, setWeekly] = useState<WeeklyHours>(initial.weekly);
  const [overrides, setOverrides] = useState<DateOverride[]>(initial.overrides);
  const [newDate, setNewDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const touch = () => setSaved(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await saveSchedule({ id: initial.id, name, timezone, weekly, overrides: [...overrides].sort((a, b) => a.date.localeCompare(b.date)) });
      if (r.error) return setError(r.error);
      setSaved(true);
      if (!initial.id && r.id) router.replace(`/dashboard/availability/${r.id}`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="sname">Schedule name</label>
          <input id="sname" className="input" required value={name} onChange={(e) => { setName(e.target.value); touch(); }} />
        </div>
        <div>
          <label className="label" htmlFor="stz">Time zone</label>
          <select id="stz" className="input" value={timezone} onChange={(e) => { setTimezone(e.target.value); touch(); }}>
            <TimezoneOptions value={timezone} />
          </select>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Weekly hours</h2>
        <p className="text-sm text-faint">When you&apos;re usually available. Busy times on your connected calendars are blocked automatically.</p>
        <div className="mt-4 divide-y divide-line">
          {DAYS.map(([key, label]) => {
            const ranges = weekly[key] ?? [];
            const on = ranges.length > 0;
            return (
              <div key={key} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
                <label className="flex w-36 shrink-0 items-center gap-2 pt-1.5 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      setWeekly({ ...weekly, [key]: e.target.checked ? [{ start: "09:00", end: "17:00" }] : [] });
                      touch();
                    }}
                  />
                  {label}
                </label>
                {on ? (
                  <RangeEditor ranges={ranges} onChange={(r) => { setWeekly({ ...weekly, [key]: r }); touch(); }} />
                ) : (
                  <span className="pt-1.5 text-sm text-faint">Unavailable</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Date overrides</h2>
        <p className="text-sm text-faint">Change your hours for specific dates, or block a day off entirely.</p>
        <div className="mt-4 space-y-3">
          {overrides.map((o, i) => (
            <div key={o.date} className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-start">
              <div className="w-36 shrink-0 pt-1.5 text-sm font-medium">{o.date}</div>
              <div className="flex-1">
                {o.ranges.length === 0 ? (
                  <div className="flex items-center gap-3 pt-1.5 text-sm text-faint">
                    Unavailable all day
                    <button type="button" className="text-accent-soft hover:underline" onClick={() => { setOverrides(overrides.map((x, j) => (j === i ? { ...x, ranges: [{ start: "09:00", end: "17:00" }] } : x))); touch(); }}>
                      Set hours instead
                    </button>
                  </div>
                ) : (
                  <RangeEditor ranges={o.ranges} onChange={(r) => { setOverrides(overrides.map((x, j) => (j === i ? { ...x, ranges: r } : x))); touch(); }} />
                )}
              </div>
              <button type="button" className="btn-ghost py-1 text-danger" onClick={() => { setOverrides(overrides.filter((_, j) => j !== i)); touch(); }}>Remove</button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="input w-44" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <button
              type="button"
              className="btn-secondary"
              disabled={!newDate || overrides.some((o) => o.date === newDate)}
              onClick={() => { setOverrides([...overrides, { date: newDate, ranges: [] }]); setNewDate(""); touch(); }}
            >
              + Add date off
            </button>
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-6 flex items-center gap-3 border-t border-line bg-canvas/85 px-6 py-4 backdrop-blur">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save"}</button>
        {saved && <span className="inline-flex items-center gap-1 text-sm text-success"><Check size={15} /> Saved</span>}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </form>
  );
}
