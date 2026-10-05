"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import type { LocationOption, Question } from "@/db/schema";
import { locationIcon, locationLabel } from "@/lib/locations";
import { Avatar } from "@/components/Avatar";

type Slot = { start: string; seatsLeft?: number };

export type BookingFlowProps = {
  host: { username: string; name: string; image: string | null };
  eventType: {
    slug: string;
    title: string;
    description: string;
    durations: number[];
    locations: LocationOption[];
    color: string;
    questions: Question[];
    seats: number;
  };
  reschedule?: { uid: string; start: string; duration: number; name: string };
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function browserTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function prefers12h() {
  return !new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hourCycle?.startsWith("h2");
}

const noopSubscribe = () => () => {};

function allTimezones(current: string) {
  let list: string[] = [];
  try {
    list = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {}
  if (!list.includes(current)) list = [current, ...list];
  if (!list.includes("UTC")) list.push("UTC");
  return list;
}

export function BookingFlow({ host, eventType, reschedule }: BookingFlowProps) {
  const router = useRouter();
  // Browser-only values: the server renders with UTC / 12h, the client switches on hydration.
  const browserZone = useSyncExternalStore(noopSubscribe, browserTz, () => "UTC");
  const browser12h = useSyncExternalStore(noopSubscribe, prefers12h, () => true);
  const [tzChoice, setTz] = useState<string | null>(null);
  const [hourChoice, setHour12] = useState<boolean | null>(null);
  const tz = tzChoice ?? browserZone;
  const hour12 = hourChoice ?? browser12h;
  const [duration, setDuration] = useState(reschedule?.duration ?? eventType.durations[0]);
  const [month, setMonth] = useState<DateTime>(() => DateTime.now().startOf("month"));
  const [result, setResult] = useState<{ key: string; slots: Slot[]; error?: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const autoAdvanced = useRef(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [showGuests, setShowGuests] = useState(false);
  const [guests, setGuests] = useState("");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [locationIndex, setLocationIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState("");

  const range = useMemo(() => {
    const monthStart = month.setZone(tz, { keepLocalTime: true }).startOf("month");
    const start = DateTime.max(monthStart, DateTime.now().setZone(tz));
    const end = monthStart.endOf("month");
    return { start, end, key: `${monthStart.toISODate()}|${tz}|${duration}` };
  }, [month, tz, duration]);
  const pastMonth = range.end < range.start;
  const current = result?.key === range.key ? result : null;
  const slots = useMemo(() => (pastMonth ? [] : current ? current.slots : null), [pastMonth, current]);
  const loadError = current?.error ?? null;

  useEffect(() => {
    if (pastMonth) return;
    let cancelled = false;
    const q = new URLSearchParams({
      user: host.username,
      type: eventType.slug,
      duration: String(duration),
      start: range.start.toUTC().toISO()!,
      end: range.end.toUTC().toISO()!,
    });
    if (reschedule) q.set("reschedule", reschedule.uid);
    fetch(`/api/slots?${q}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not load availability");
        return data.slots as Slot[];
      })
      .then((s) => {
        if (cancelled) return;
        setResult({ key: range.key, slots: s });
        // First visit: if nothing is free this month, jump to next month once.
        if (s.length === 0 && !autoAdvanced.current) setMonth((m) => m.plus({ months: 1 }));
        autoAdvanced.current = true;
      })
      .catch((e) => !cancelled && setResult({ key: range.key, slots: [], error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [range, pastMonth, duration, host.username, eventType.slug, reschedule]);

  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const d = DateTime.fromISO(s.start).setZone(tz).toISODate()!;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(s);
    }
    return map;
  }, [slots, tz]);

  const days = useMemo(() => {
    const first = month.setZone(tz, { keepLocalTime: true }).startOf("month");
    const lead = first.weekday % 7; // Sunday-first grid
    const cells: (DateTime | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 0; d < first.daysInMonth!; d++) cells.push(first.plus({ days: d }));
    return cells;
  }, [month, tz]);

  const fmtTime = (iso: string) =>
    DateTime.fromISO(iso).setZone(tz).toFormat(hour12 ? "h:mm a" : "HH:mm");

  const today = DateTime.now().setZone(tz).toISODate();
  const canGoBack = month.startOf("month") > DateTime.now().setZone(tz).startOf("month");
  const loc = eventType.locations[locationIndex];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = reschedule
        ? await fetch(`/api/bookings/${reschedule.uid}/reschedule`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ start: selectedSlot.start, timezone: tz }),
          })
        : await fetch("/api/bookings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user: host.username,
              type: eventType.slug,
              start: selectedSlot.start,
              duration,
              timezone: tz,
              name,
              email,
              guests: guests
                .split(/[\s,;]+/)
                .map((g) => g.trim())
                .filter(Boolean),
              notes,
              answers,
              locationIndex,
              phone: loc?.type === "phone_host_calls" ? phone : undefined,
              website,
            }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");
      router.push(`/booking/${data.uid}?${reschedule ? "rescheduled" : "new"}=1`);
    } catch (err) {
      setSubmitError((err as Error).message);
      setSubmitting(false);
    }
  }

  const info = (
    <div className="border-b border-slate-200 p-6 md:w-80 md:shrink-0 md:border-r md:border-b-0">
      <div className="flex items-center gap-3">
        <Avatar name={host.name || host.username} image={host.image} size={40} />
        <span className="text-sm font-medium text-slate-500">{host.name || host.username}</span>
      </div>
      <h1 className="mt-4 text-2xl font-semibold">{eventType.title}</h1>
      {reschedule && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Rescheduling your booking from{" "}
          <strong>{DateTime.fromISO(reschedule.start).setZone(tz).toFormat("ccc, LLL d 'at' h:mm a")}</strong>
        </p>
      )}
      <div className="mt-4 space-y-3 text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span>⏱</span>
          {eventType.durations.length > 1 && !reschedule ? (
            eventType.durations.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDuration(d);
                  setSelectedSlot(null);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  d === duration ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 hover:border-slate-400"
                }`}
              >
                {d} min
              </button>
            ))
          ) : (
            <span>{duration} min</span>
          )}
        </div>
        {eventType.locations.map((l, i) => (
          <div key={i} className="flex gap-2">
            <span>{locationIcon(l.type)}</span>
            <span>
              {locationLabel(l)}
              {l.type === "in_person" && l.address ? `: ${l.address}` : ""}
            </span>
          </div>
        ))}
        {eventType.seats > 1 && (
          <div className="flex gap-2">
            <span>👥</span>
            <span>Group event, up to {eventType.seats} people</span>
          </div>
        )}
        {selectedSlot && (
          <div className="flex gap-2 font-medium text-slate-900">
            <span>📅</span>
            <span>
              {fmtTime(selectedSlot.start)} –{" "}
              {fmtTime(DateTime.fromISO(selectedSlot.start).plus({ minutes: duration }).toISO()!)},{" "}
              {DateTime.fromISO(selectedSlot.start).setZone(tz).toFormat("cccc, LLLL d, yyyy")}
            </span>
          </div>
        )}
        {selectedSlot && (
          <div className="flex gap-2">
            <span>🌐</span>
            <span>{tz.replace(/_/g, " ")}</span>
          </div>
        )}
      </div>
      {eventType.description && (
        <p className="mt-5 whitespace-pre-line text-sm text-slate-600">{eventType.description}</p>
      )}
    </div>
  );

  if (selectedSlot) {
    return (
      <div className="card flex flex-col overflow-hidden md:flex-row">
        {info}
        <form onSubmit={submit} className="flex-1 space-y-4 p-6">
          <button type="button" onClick={() => setSelectedSlot(null)} className="btn-ghost -ml-2 px-2">
            ← Back
          </button>
          {reschedule ? (
            <>
              <h2 className="text-lg font-semibold">Confirm new time</h2>
              <p className="text-sm text-slate-600">
                {reschedule.name}, your meeting will move to the time shown. Everyone on the invite will get an
                updated calendar invitation.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">Enter details</h2>
              <div>
                <label className="label" htmlFor="name">Name *</label>
                <input id="name" className="input" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <label className="label" htmlFor="email">Email *</label>
                <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              {showGuests ? (
                <div>
                  <label className="label" htmlFor="guests">Guest emails</label>
                  <textarea id="guests" className="input" rows={2} placeholder="alex@example.com, sam@example.com" value={guests} onChange={(e) => setGuests(e.target.value)} />
                  <p className="help">Separate with commas. Guests get the calendar invite too.</p>
                </div>
              ) : (
                <button type="button" onClick={() => setShowGuests(true)} className="btn-secondary">
                  + Add guests
                </button>
              )}
              {eventType.locations.length > 1 && (
                <fieldset>
                  <legend className="label">Where should we meet? *</legend>
                  <div className="space-y-2">
                    {eventType.locations.map((l, i) => (
                      <label key={i} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                        <input type="radio" name="loc" checked={locationIndex === i} onChange={() => setLocationIndex(i)} />
                        <span>{locationIcon(l.type)}</span>
                        <span>
                          {locationLabel(l)}
                          {l.type === "in_person" && l.address ? `: ${l.address}` : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {loc?.type === "phone_host_calls" && (
                <div>
                  <label className="label" htmlFor="phone">Phone number *</label>
                  <input id="phone" type="tel" className="input" required value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                </div>
              )}
              {eventType.questions.map((q) => (
                <div key={q.id}>
                  <label className="label" htmlFor={`q-${q.id}`}>
                    {q.label}
                    {q.required && " *"}
                  </label>
                  {q.type === "textarea" ? (
                    <textarea id={`q-${q.id}`} className="input" rows={3} required={q.required} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                  ) : q.type === "select" ? (
                    <select id={`q-${q.id}`} className="input" required={q.required} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}>
                      <option value="">Select…</option>
                      {(q.options ?? []).map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input id={`q-${q.id}`} type={q.type === "phone" ? "tel" : "text"} className="input" required={q.required} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                  )}
                </div>
              ))}
              <div>
                <label className="label" htmlFor="notes">Anything that will help prepare for the meeting?</label>
                <textarea id="notes" className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <input type="text" tabIndex={-1} autoComplete="off" className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden />
            </>
          )}
          {submitError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>}
          <button type="submit" disabled={submitting} className="btn-primary px-6 py-2.5">
            {submitting ? "Scheduling…" : reschedule ? "Reschedule event" : "Schedule event"}
          </button>
        </form>
      </div>
    );
  }

  const daySlots = selectedDate ? byDate.get(selectedDate) ?? [] : [];

  return (
    <div className="card flex flex-col overflow-hidden md:flex-row">
      {info}
      <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Select a date & time</h2>
          <div className="mt-4 flex items-center justify-between">
            <span className="font-medium">{month.toFormat("LLLL yyyy")}</span>
            <div className="flex gap-1">
              <button type="button" disabled={!canGoBack} onClick={() => { setMonth(month.minus({ months: 1 })); setSelectedDate(null); }} className="btn-ghost px-3" aria-label="Previous month">‹</button>
              <button type="button" onClick={() => { setMonth(month.plus({ months: 1 })); setSelectedDate(null); }} className="btn-ghost px-3" aria-label="Next month">›</button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              if (!d) return <div key={i} />;
              const iso = d.toISODate()!;
              const available = byDate.has(iso);
              const selected = iso === selectedDate;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!available}
                  onClick={() => setSelectedDate(iso)}
                  className={`relative mx-auto grid aspect-square w-full max-w-11 place-items-center rounded-full text-sm transition ${
                    selected
                      ? "bg-blue-600 font-semibold text-white"
                      : available
                        ? "bg-blue-50 font-semibold text-blue-700 hover:bg-blue-100"
                        : "text-slate-400"
                  }`}
                >
                  {d.day}
                  {iso === today && <span className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? "bg-white" : "bg-slate-400"}`} />}
                </button>
              );
            })}
          </div>
          {slots === null && !loadError && <p className="mt-4 text-sm text-slate-500">Loading availability…</p>}
          {loadError && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>}
          {slots && slots.length === 0 && !loadError && <p className="mt-4 text-sm text-slate-500">No times available this month.</p>}

          <div className="mt-6">
            <label className="label" htmlFor="tz">Time zone</label>
            <div className="flex gap-2">
              <select id="tz" className="input" value={tz} onChange={(e) => setTz(e.target.value)}>
                {allTimezones(tz).map((z) => (
                  <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
                ))}
              </select>
              <button type="button" onClick={() => setHour12(!hour12)} className="btn-secondary shrink-0">
                {hour12 ? "12h" : "24h"}
              </button>
            </div>
          </div>
        </div>

        {selectedDate && (
          <div className="lg:w-52">
            <h3 className="font-medium">{DateTime.fromISO(selectedDate).toFormat("cccc, LLLL d")}</h3>
            <div className="mt-4 flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
              {daySlots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => setSelectedSlot(s)}
                  className="rounded-lg border border-blue-300 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:border-blue-600 hover:bg-blue-50"
                >
                  {fmtTime(s.start)}
                  {s.seatsLeft !== undefined && (
                    <span className="block text-xs font-normal text-slate-500">{s.seatsLeft} seat{s.seatsLeft === 1 ? "" : "s"} left</span>
                  )}
                </button>
              ))}
              {daySlots.length === 0 && <p className="text-sm text-slate-500">No times left on this day.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
