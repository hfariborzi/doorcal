"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import type { BookingPreferences, LocationOption, Question } from "@/db/schema";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Loader2,
  RefreshCw,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import { locationLabel } from "@/lib/locations";
import { Avatar } from "@/components/Avatar";
import { LocationIcon } from "@/components/LocationIcon";
import { TimezoneOptions } from "@/components/TimezoneOptions";

type Slot = { start: string; seatsLeft?: number; preferred?: boolean };

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
    preferences: BookingPreferences | null;
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
  const prefs = eventType.preferences;
  const preferredLoc = prefs?.locationIndex != null && prefs.locationIndex < eventType.locations.length ? prefs.locationIndex : null;
  const [locationIndex, setLocationIndex] = useState(preferredLoc ?? 0);
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
  const hasPreferredTimes = useMemo(() => (slots ?? []).some((s) => s.preferred), [slots]);

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

  const hostName = host.name || host.username;
  const slotStart = selectedSlot ? DateTime.fromISO(selectedSlot.start).setZone(tz) : null;
  const slotEnd = slotStart?.plus({ minutes: duration });

  const durationPicker =
    eventType.durations.length > 1 && !reschedule ? (
      <div className="inline-flex rounded-lg border border-line bg-well p-1" role="radiogroup" aria-label="Meeting length">
        {eventType.durations.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={d === duration}
            onClick={() => {
              setDuration(d);
              setSelectedSlot(null);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium tnum transition ${
              d === duration ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
            }`}
          >
            {d} min
          </button>
        ))}
      </div>
    ) : null;

  const rescheduleBanner = reschedule && (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-line bg-accent/10 px-4 py-3 text-sm">
      <RefreshCw size={18} className="shrink-0 text-accent-soft" />
      <div>
        <div className="font-medium text-ink">Rescheduling your booking</div>
        <div className="text-muted">
          Originally{" "}
          <span className="text-accent-soft tnum">
            {DateTime.fromISO(reschedule.start).setZone(tz).toFormat(hour12 ? "ccc, LLL d 'at' h:mm a" : "ccc, LLL d 'at' HH:mm")}
          </span>
        </div>
      </div>
    </div>
  );

  // Step 2: the invitee's details.
  if (selectedSlot && slotStart && slotEnd) {
    return (
      <div>
        <button type="button" onClick={() => setSelectedSlot(null)} className="btn-ghost -ml-3 mb-6">
          <ArrowLeft size={16} /> Back to date &amp; time
        </button>
        {rescheduleBanner}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <aside className="card h-fit p-6">
            <p className="eyebrow">Your meeting</p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{eventType.title}</h1>
            <div className="mt-5 flex items-center gap-3">
              <Avatar name={hostName} image={host.image} size={36} />
              <span className="text-sm text-muted">with {hostName}</span>
            </div>
            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex gap-3">
                <CalendarDays size={18} className="mt-0.5 shrink-0 text-accent-soft" />
                <div>
                  <dt className="font-medium text-ink">{slotStart.toFormat("cccc, LLLL d, yyyy")}</dt>
                  <dd className="text-muted tnum">
                    {fmtTime(slotStart.toISO()!)} – {fmtTime(slotEnd.toISO()!)} ({duration} min)
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Globe size={18} className="mt-0.5 shrink-0 text-accent-soft" />
                <div>
                  <dt className="font-medium text-ink">{tz.replace(/_/g, " ")}</dt>
                  <dd className="text-muted">{slotStart.toFormat("ZZZZZ")}</dd>
                </div>
              </div>
              {eventType.seats > 1 && (
                <div className="flex gap-3">
                  <Users size={18} className="mt-0.5 shrink-0 text-accent-soft" />
                  <dt className="text-muted">Group event, up to {eventType.seats} people</dt>
                </div>
              )}
            </dl>
          </aside>

          <form onSubmit={submit} className="card space-y-6 p-6 sm:p-8">
            {reschedule ? (
              <div>
                <h2 className="text-lg font-semibold">Confirm the new time</h2>
                <p className="mt-2 text-sm text-muted">
                  {reschedule.name}, your meeting will move to the time shown. Everyone on the invitation gets an
                  updated calendar invite.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="name">Your name *</label>
                    <input id="name" className="input" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                  </div>
                  <div>
                    <label className="label" htmlFor="email">Email address *</label>
                    <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                </div>
                {showGuests ? (
                  <div>
                    <label className="label" htmlFor="guests">Guest emails</label>
                    <textarea id="guests" className="input" rows={2} placeholder="alex@example.com, sam@example.com" value={guests} onChange={(e) => setGuests(e.target.value)} />
                    <p className="help">Separate with commas. Guests get the calendar invitation too.</p>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowGuests(true)} className="btn-ghost -ml-3 text-accent-soft">
                    <UserPlus size={16} /> Add guests
                  </button>
                )}
                {eventType.locations.length > 1 && (
                  <fieldset>
                    <legend className="label">Where should we meet? *</legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {eventType.locations.map((l, i) => (
                        <label
                          key={i}
                          className="relative flex cursor-pointer flex-col gap-3 rounded-xl border border-line bg-well p-4 text-sm transition hover:border-line-strong has-[:checked]:border-accent has-[:checked]:bg-accent/15"
                        >
                          <input type="radio" name="loc" className="sr-only" checked={locationIndex === i} onChange={() => setLocationIndex(i)} />
                          <span className="flex items-center justify-between">
                            <LocationIcon type={l.type} size={20} className="text-accent-soft" />
                            {preferredLoc === i && <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[11px] font-medium text-accent-soft">Preferred</span>}
                          </span>
                          <span>
                            <span className="block font-medium text-ink">{locationLabel(l)}</span>
                            {l.type === "in_person" && l.address && <span className="mt-0.5 block text-faint">{l.address}</span>}
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
                  <label className="label" htmlFor="notes">Anything that will help prepare?</label>
                  <textarea id="notes" className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <input type="text" tabIndex={-1} autoComplete="off" className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden />
              </>
            )}
            {submitError && <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{submitError}</p>}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button type="submit" disabled={submitting} className="btn-primary flex-1 py-3 text-base sm:flex-none sm:px-10">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
                {submitting ? "Scheduling…" : reschedule ? "Reschedule event" : "Schedule event"}
              </button>
              <button type="button" onClick={() => setSelectedSlot(null)} className="btn-ghost">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 1: pick a date and time.
  const daySlots = selectedDate ? byDate.get(selectedDate) ?? [] : [];

  return (
    <div>
      {rescheduleBanner}
      <header className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-4">
          <Avatar name={hostName} image={host.image} size={56} />
          <div className="min-w-0">
            <p className="text-sm text-muted">{hostName}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em]">{eventType.title}</h1>
            {eventType.description && <p className="mt-3 max-w-2xl text-sm leading-relaxed whitespace-pre-line text-muted">{eventType.description}</p>}
            {prefs?.note && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-sm text-accent-soft">
                <Star size={14} /> {prefs.note}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {!durationPicker && (
                <span className="inline-flex items-center gap-1.5 tnum"><Clock size={15} strokeWidth={1.75} className="text-accent-soft" />{duration} min</span>
              )}
              {eventType.locations.map((l, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  <LocationIcon type={l.type} size={15} className="text-accent-soft" />
                  {locationLabel(l)}
                  {l.type === "in_person" && l.address ? `: ${l.address}` : ""}
                  {preferredLoc === i && <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[11px] font-medium text-accent-soft">Preferred</span>}
                </span>
              ))}
              {eventType.seats > 1 && (
                <span className="inline-flex items-center gap-1.5"><Users size={15} strokeWidth={1.75} className="text-accent-soft" />Group, up to {eventType.seats} people</span>
              )}
            </div>
          </div>
        </div>
        {durationPicker && (
          <div className="shrink-0">
            <p className="eyebrow mb-2">Length</p>
            {durationPicker}
          </div>
        )}
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">{month.toFormat("LLLL yyyy")}</h2>
            <div className="flex gap-1">
              <button type="button" disabled={!canGoBack} onClick={() => { setMonth(month.minus({ months: 1 })); setSelectedDate(null); }} className="btn-ghost px-2.5" aria-label="Previous month"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => { setMonth(month.plus({ months: 1 })); setSelectedDate(null); }} className="btn-ghost px-2.5" aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-xs font-semibold tracking-[0.08em] text-faint uppercase">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              if (!d) return <div key={i} />;
              const iso = d.toISODate()!;
              const available = byDate.has(iso);
              const preferredDay = hasPreferredTimes && (byDate.get(iso) ?? []).some((s) => s.preferred);
              const selected = iso === selectedDate;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!available}
                  onClick={() => setSelectedDate(iso)}
                  aria-pressed={selected}
                  className={`relative mx-auto grid aspect-square w-full max-w-14 place-items-center rounded-xl text-sm tnum transition ${
                    selected
                      ? "bg-accent font-semibold text-on-accent shadow-[0_0_0_2px_var(--color-canvas),0_0_0_4px_var(--color-accent-soft)]"
                      : available
                        ? "bg-hover font-semibold text-ink hover:bg-accent/25"
                        : "text-faint/50"
                  }`}
                >
                  {d.day}
                  {available && !selected && <span className={`absolute bottom-1.5 h-1 w-1 rounded-full ${hasPreferredTimes && !preferredDay ? "bg-faint" : "bg-accent-soft"}`} />}
                  {iso === today && !available && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-faint" />}
                </button>
              );
            })}
          </div>
          {slots === null && !loadError && (
            <p className="mt-5 inline-flex items-center gap-2 text-sm text-faint"><Loader2 size={15} className="animate-spin" /> Loading availability…</p>
          )}
          {loadError && <p className="mt-5 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{loadError}</p>}
          {slots && slots.length === 0 && !loadError && <p className="mt-5 text-sm text-faint">No times available this month.</p>}
        </section>

        <section className="lg:border-l lg:border-line lg:pl-8">
          {selectedDate ? (
            <>
              <h3 className="text-xl font-semibold tracking-tight">{DateTime.fromISO(selectedDate).toFormat("cccc, LLL d")}</h3>
              <p className="mt-1 text-sm text-faint">
                {daySlots.length} {daySlots.length === 1 ? "time" : "times"} available
              </p>
              <div className="mt-5 flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
                {[...daySlots].sort((a, b) => Number(!!b.preferred) - Number(!!a.preferred) || a.start.localeCompare(b.start)).map((s, i, arr) => (
                  <Fragment key={s.start}>
                  {hasPreferredTimes && (i === 0 || !!arr[i - 1].preferred !== !!s.preferred) && (
                    <p className="eyebrow pt-1 first:pt-0">{s.preferred ? "Preferred times" : "Other times"}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedSlot(s)}
                    className={`group flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition hover:border-accent/60 hover:bg-accent/15 ${s.preferred ? "border-accent/50 bg-accent/10" : "border-line bg-paper"}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-semibold text-ink tnum">{fmtTime(s.start)}</span>
                      {s.preferred && <Star size={14} className="text-accent-soft" />}
                      {s.seatsLeft !== undefined && (
                        <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-xs font-medium text-accent-soft">
                          {s.seatsLeft} seat{s.seatsLeft === 1 ? "" : "s"} left
                        </span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm text-muted group-hover:text-ink">
                      Select <ArrowRight size={15} />
                    </span>
                  </button>
                  </Fragment>
                ))}
                {daySlots.length === 0 && <p className="text-sm text-faint">No times left on this day.</p>}
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center text-sm text-faint">
              <CalendarDays size={22} strokeWidth={1.5} />
              Pick a highlighted day to see the times.
            </div>
          )}
        </section>
      </div>

      <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 items-center gap-3">
          <Globe size={18} className="shrink-0 text-faint" />
          <span className="sr-only">Time zone</span>
          <select className="input w-full border-transparent bg-transparent px-1 sm:w-80" value={tz} onChange={(e) => setTz(e.target.value)}>
            <TimezoneOptions value={tz} />
          </select>
        </label>
        <div className="inline-flex shrink-0 self-start rounded-lg border border-line bg-well p-1 text-xs font-medium sm:self-auto" role="radiogroup" aria-label="Clock format">
          {[true, false].map((h) => (
            <button
              key={String(h)}
              type="button"
              role="radio"
              aria-checked={hour12 === h}
              onClick={() => setHour12(h)}
              className={`rounded-md px-3 py-1 ${hour12 === h ? "bg-accent text-on-accent" : "text-muted hover:text-ink"}`}
            >
              {h ? "12h" : "24h"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
