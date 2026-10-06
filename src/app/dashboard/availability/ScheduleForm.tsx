"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DateOverride, WeeklyHours } from "@/db/schema";
import { RangeEditor, WeeklyHoursEditor } from "@/components/WeeklyHoursEditor";
import { saveSchedule } from "../actions";
import { TimezoneOptions } from "@/components/TimezoneOptions";

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
        <div className="mt-4">
          <WeeklyHoursEditor weekly={weekly} onChange={(w) => { setWeekly(w); touch(); }} />
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

      <div className="sticky bottom-0 -mx-6 flex items-center gap-3 border-t border-line bg-canvas/90 px-6 py-4 backdrop-blur">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save"}</button>
        {saved && <span className="inline-flex items-center gap-1 text-sm text-success"><Check size={15} /> Saved</span>}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </form>
  );
}
