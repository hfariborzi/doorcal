"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, MapPin, Plus, Trash2, Users, Video, X } from "lucide-react";
import type { CalendarEvent } from "@/lib/calendar/types";
import { meetingLinkLabel } from "@/lib/locations";

type Problem = { accountId: number; email: string; message: string };

const HOUR_PX = 48;

type View = "week" | "day";

function layoutDay(events: CalendarEvent[], dayStart: DateTime) {
  const dayEnd = dayStart.plus({ days: 1 });
  const items = events
    .map((e) => {
      const s = DateTime.max(DateTime.fromISO(e.start), dayStart);
      const en = DateTime.min(DateTime.fromISO(e.end), dayEnd);
      return { e, s: s.toMillis(), en: Math.max(en.toMillis(), s.toMillis() + 15 * 60_000) };
    })
    .sort((a, b) => a.s - b.s || b.en - a.en);

  const placed: { e: CalendarEvent; s: number; en: number; lane: number; lanes: number }[] = [];
  let cluster: typeof placed = [];
  let clusterEnd = 0;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => (c.lanes = lanes));
    cluster = [];
  };
  for (const it of items) {
    if (it.s >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => c.en > it.s).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    const p = { ...it, lane, lanes: 1 };
    cluster.push(p);
    placed.push(p);
    clusterEnd = Math.max(clusterEnd, it.en);
  }
  flush();
  return placed.map((p) => ({
    ...p,
    top: ((p.s - dayStart.toMillis()) / 3_600_000) * HOUR_PX,
    height: Math.max(((p.en - p.s) / 3_600_000) * HOUR_PX, 18),
  }));
}

/** Event blocks: a dark tint of the calendar's color with a solid left edge. */
function eventStyle(color: string): React.CSSProperties {
  return {
    background: `color-mix(in srgb, ${color} 30%, #1d1530)`,
    borderLeft: `3px solid ${color}`,
  };
}

function stripHtml(html: string) {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

const noopSubscribe = () => () => {};
const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const isNarrow = () => window.innerWidth < 768;

export function CalendarView() {
  const tz = useSyncExternalStore(noopSubscribe, browserTz, () => "UTC");
  const narrow = useSyncExternalStore(noopSubscribe, isNarrow, () => false);
  const [viewChoice, setView] = useState<View | null>(null);
  const view: View = viewChoice ?? (narrow ? "day" : "week");
  const [anchor, setAnchor] = useState<DateTime>(() => DateTime.now().startOf("day"));
  const [result, setResult] = useState<{ rangeKey: string; events: CalendarEvent[]; problems: Problem[]; error?: string } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [creating, setCreating] = useState<DateTime | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const range = useMemo(() => {
    const a = anchor.setZone(tz, { keepLocalTime: true }).startOf("day");
    const start = view === "week" ? a.minus({ days: a.weekday % 7 }) : a; // Sunday-first weeks
    const days = view === "week" ? 7 : 1;
    return {
      key: `${start.toISO()}|${days}`,
      start,
      end: start.plus({ days }),
      days: Array.from({ length: days }, (_, i) => start.plus({ days: i })),
    };
  }, [anchor, view, tz]);

  const events = result?.rangeKey === range.key ? result.events : null;
  const error = result?.rangeKey === range.key ? (result.error ?? null) : null;
  const problems = result?.rangeKey === range.key ? result.problems : [];
  const load = () => setReloadTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ start: range.start.toUTC().toISO()!, end: range.end.toUTC().toISO()! });
    fetch(`/api/calendar/events?${q}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load your calendar");
        if (!cancelled) setResult({ rangeKey: range.key, events: data.events, problems: data.problems ?? [] });
      })
      .catch((e) => !cancelled && setResult({ rangeKey: range.key, events: [], problems: [], error: (e as Error).message }));
    return () => {
      cancelled = true;
    };
  }, [range, reloadTick]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7.5 * HOUR_PX;
  }, [view]);

  const timed = (events ?? []).filter((e) => !e.allDay);
  const allDay = (events ?? []).filter((e) => e.allDay);
  const now = DateTime.now().setZone(tz);

  const title =
    view === "week"
      ? range.start.hasSame(range.end.minus({ days: 1 }), "month")
        ? range.start.toFormat("LLLL yyyy")
        : `${range.start.toFormat("LLL")} – ${range.end.minus({ days: 1 }).toFormat("LLL yyyy")}`
      : range.start.toFormat("cccc, LLLL d, yyyy");

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="flex items-center gap-2">
          <button className="btn-secondary py-1.5" onClick={() => setAnchor(DateTime.now().setZone(tz).startOf("day"))}>
            Today
          </button>
          <button className="btn-ghost px-2 py-1.5" aria-label="Previous" onClick={() => setAnchor(anchor.minus(view === "week" ? { weeks: 1 } : { days: 1 }))}><ChevronLeft size={18} /></button>
          <button className="btn-ghost px-2 py-1.5" aria-label="Next" onClick={() => setAnchor(anchor.plus(view === "week" ? { weeks: 1 } : { days: 1 }))}><ChevronRight size={18} /></button>
          <h2 className="ml-2 text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line bg-black/20 p-1 text-sm">
            {(["day", "week"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 capitalize ${view === v ? "bg-accent text-white" : "text-muted hover:text-ink"}`}>
                {v}
              </button>
            ))}
          </div>
          <button className="btn-primary py-1.5" onClick={() => setCreating(now.plus({ hours: 1 }).startOf("hour"))}>
            <Plus size={16} /> New meeting
          </button>
        </div>
      </div>

      {error && <p className="m-4 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {problems.length > 0 && (
        <p className="m-4 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
          {problems.map((p) => `${p.email} ${p.message}`).join(". ")}.
        </p>
      )}

      <div className="flex border-b border-line bg-black/10">
        <div className="w-14 shrink-0" />
        {range.days.map((d) => {
          const isToday = d.hasSame(now, "day");
          return (
            <div key={d.toISODate()} className="min-w-0 flex-1 border-l border-line px-1 py-2.5 text-center">
              <div className={`text-xs font-semibold tracking-[0.08em] uppercase ${isToday ? "text-accent-soft" : "text-faint"}`}>{d.toFormat("ccc")}</div>
              <div className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full text-lg tnum ${isToday ? "bg-accent font-semibold text-white shadow-[0_0_14px_rgb(124_58_237/0.5)]" : "text-ink"}`}>
                {d.day}
              </div>
              <div className="mt-1 space-y-0.5">
                {allDay
                  .filter((e) => {
                    const s = DateTime.fromISO(e.start, { zone: tz });
                    const en = DateTime.fromISO(e.end, { zone: tz });
                    return s <= d && en > d;
                  })
                  .map((e) => (
                    <button key={`${e.accountId}-${e.calendarId}-${e.id}`} onClick={() => setSelected(e)} className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-xs text-ink" style={eventStyle(e.color)}>
                      {e.title}
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={scroller} className="relative h-[65vh] overflow-y-auto">
        <div className="relative flex" style={{ height: 24 * HOUR_PX }}>
          <div className="w-14 shrink-0">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="relative text-right text-xs text-faint tnum" style={{ height: HOUR_PX }}>
                {h > 0 && <span className="absolute -top-2 right-2">{DateTime.fromObject({ hour: h }).toFormat("h a")}</span>}
              </div>
            ))}
          </div>
          {range.days.map((d) => {
            const dayStart = d.startOf("day");
            const dayEvents = timed.filter((e) => {
              const s = DateTime.fromISO(e.start).toMillis();
              const en = DateTime.fromISO(e.end).toMillis();
              return s < dayStart.plus({ days: 1 }).toMillis() && en > dayStart.toMillis();
            });
            return (
              <div
                key={d.toISODate()}
                className={`relative min-w-0 flex-1 cursor-pointer border-l border-line ${d.hasSame(now, "day") ? "bg-gradient-to-b from-accent/[0.07] to-transparent" : ""}`}
                onClick={(ev) => {
                  const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const minutes = Math.floor(((ev.clientY - rect.top) / HOUR_PX) * 2) * 30;
                  setCreating(dayStart.plus({ minutes }));
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="border-t border-line" style={{ height: HOUR_PX }} />
                ))}
                {d.hasSame(now, "day") && (
                  <div className="pointer-events-none absolute right-0 left-0 z-20 h-px bg-accent-soft" style={{ top: (now.diff(dayStart, "minutes").minutes / 60) * HOUR_PX }}>
                    <span className="absolute -top-[5px] -left-1.5 h-2.5 w-2.5 rounded-full bg-accent-soft shadow-[0_0_10px_rgb(210_187_255/0.8)]" />
                  </div>
                )}
                {layoutDay(dayEvents, dayStart).map((p) => (
                  <button
                    key={`${p.e.accountId}-${p.e.calendarId}-${p.e.id}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelected(p.e);
                    }}
                    className="absolute z-10 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs text-ink shadow-[0_4px_12px_-4px_rgb(0_0_0/0.6)] hover:z-30 hover:brightness-125"
                    style={{
                      top: p.top,
                      height: p.height,
                      left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                      width: `calc(${100 / p.lanes}% - 4px)`,
                      ...eventStyle(p.e.color),
                    }}
                  >
                    <div className="truncate font-medium">{p.e.title}</div>
                    {p.height > 30 && (
                      <div className="truncate text-muted tnum">
                        {DateTime.fromISO(p.e.start).setZone(tz).toFormat("h:mm")} – {DateTime.fromISO(p.e.end).setZone(tz).toFormat("h:mm a")}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        {events === null && (
          <div className="absolute inset-0 grid place-items-center bg-canvas/60 text-sm text-muted">
            <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading your calendar…</span>
          </div>
        )}
      </div>

      {selected && (
        <EventDetails
          event={selected}
          tz={tz}
          onClose={() => setSelected(null)}
          onDeleted={() => {
            setSelected(null);
            load();
          }}
        />
      )}
      {creating && (
        <NewMeeting
          start={creating}
          tz={tz}
          onClose={() => setCreating(null)}
          onCreated={() => {
            setCreating(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a0418]/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line-strong bg-[#180933]/90 p-6 shadow-[0_16px_40px_-8px_rgb(0_0_0/0.8),0_0_20px_rgb(124_58_237/0.15)] backdrop-blur-xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function EventDetails({ event, tz, onClose, onDeleted }: { event: CalendarEvent; tz: string; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = DateTime.fromISO(event.start).setZone(tz);
  const e = DateTime.fromISO(event.end).setZone(tz);

  async function remove() {
    if (!confirm("Delete this event? Guests will be notified.")) return;
    setDeleting(true);
    const q = new URLSearchParams({ accountId: String(event.accountId), calendarId: event.calendarId, eventId: event.id });
    const res = await fetch(`/api/calendar/events?${q}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not delete");
      setDeleting(false);
      return;
    }
    onDeleted();
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-start gap-3">
        <span className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ background: event.color }} />
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold tracking-tight break-words">{event.title}</h3>
          <p className="mt-1 text-sm text-muted tnum">
            {event.allDay
              ? DateTime.fromISO(event.start).toFormat("cccc, LLLL d")
              : `${s.toFormat("cccc, LLLL d · h:mm a")} – ${e.toFormat("h:mm a")}`}
          </p>
        </div>
        <button onClick={onClose} className="btn-ghost px-2 py-1" aria-label="Close"><X size={18} /></button>
      </div>
      <div className="mt-6 space-y-5 text-sm">
        {event.meetLink && (
          <a href={event.meetLink} target="_blank" rel="noreferrer" className="btn-primary w-full py-2.5"><Video size={16} /> Join with {meetingLinkLabel(event.meetLink)}</a>
        )}
        {event.location && (
          <p className="flex gap-2.5 text-muted"><MapPin size={16} className="mt-0.5 shrink-0 text-accent-soft" /> <span className="break-words">{event.location}</span></p>
        )}
        {event.attendees.length > 0 && (
          <div>
            <p className="flex items-center gap-2.5 font-medium text-ink"><Users size={16} className="text-accent-soft" /> {event.attendees.length} guest{event.attendees.length === 1 ? "" : "s"}</p>
            <ul className="mt-2 space-y-1 pl-6.5 text-muted">
              {event.attendees.map((a) => (
                <li key={a.email}>
                  {a.name ? `${a.name} · ` : ""}
                  {a.email}
                  {a.status && a.status !== "needsAction" && <span className="ml-1 text-xs text-faint">({a.status})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {event.description && <p className="rounded-xl bg-black/20 p-4 break-words whitespace-pre-line text-muted">{stripHtml(event.description)}</p>}
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5">
        {event.canEdit ? (
          <button onClick={remove} disabled={deleting} className="btn-ghost text-danger hover:text-danger"><Trash2 size={16} /> {deleting ? "Deleting…" : "Delete"}</button>
        ) : <span />}
        {event.htmlLink && (
          <a href={event.htmlLink} target="_blank" rel="noreferrer" className="btn-secondary"><ExternalLink size={15} /> Open in calendar</a>
        )}
      </div>
    </Modal>
  );
}

function NewMeeting({ start, tz, onClose, onCreated }: { start: DateTime; tz: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(start.toISODate()!);
  const [from, setFrom] = useState(start.toFormat("HH:mm"));
  const [to, setTo] = useState(start.plus({ minutes: 30 }).toFormat("HH:mm"));
  const [attendees, setAttendees] = useState("");
  const [locationType, setLocationType] = useState("online");
  const [locationValue, setLocationValue] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Writable calendars across all connected accounts; "" means the user's default.
  const [targets, setTargets] = useState<{ value: string; label: string; onlineMeetings: boolean }[] | null>(null);
  const [target, setTarget] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calendar/calendars")
      .then((r) => r.json())
      .then((d: { targets?: { value: string; label: string; onlineMeetings: boolean }[]; default?: { accountId: number | null; calendarId: string } }) => {
        if (cancelled) return;
        const list = d.targets ?? [];
        setTargets(list);
        const def = `${d.default?.accountId}:${d.default?.calendarId}`;
        setTarget(list.some((t) => t.value === def) ? def : (list[0]?.value ?? ""));
      })
      .catch(() => !cancelled && setTargets([]));
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const s = DateTime.fromISO(`${date}T${from}`, { zone: tz });
    let e = DateTime.fromISO(`${date}T${to}`, { zone: tz });
    if (e <= s) e = e.plus({ days: 1 });
    const res = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        start: s.toUTC().toISO(),
        end: e.toUTC().toISO(),
        timezone: tz,
        attendees: attendees.split(/[\s,;]+/).filter(Boolean),
        description,
        locationType,
        locationValue,
        ...(target ? { accountId: Number(target.slice(0, target.indexOf(":"))), calendarId: target.slice(target.indexOf(":") + 1) } : {}),
      }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not create the meeting");
      setBusy(false);
      return;
    }
    onCreated();
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">New meeting</h3>
          <button type="button" onClick={onClose} className="btn-ghost px-2 py-1" aria-label="Close"><X size={18} /></button>
        </div>
        <div>
          <label className="label" htmlFor="nm-title">Title</label>
          <input id="nm-title" className="input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project sync" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label" htmlFor="nm-date">Date</label>
            <input id="nm-date" type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="nm-from">Start</label>
            <input id="nm-from" type="time" className="input" required value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="nm-to">End</label>
            <input id="nm-to" type="time" className="input" required value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="nm-loc">Location</label>
          <select id="nm-loc" className="input" value={locationType} onChange={(e) => setLocationType(e.target.value)}>
            <option value="online">Video call (Meet or Teams link added automatically)</option>
            <option value="in_person">In person</option>
            <option value="phone">Phone call</option>
            <option value="custom_link">Other video link (Zoom, Teams…)</option>
            <option value="none">No location</option>
          </select>
          {(locationType === "in_person" || locationType === "phone" || locationType === "custom_link") && (
            <input
              className="input mt-2"
              required
              value={locationValue}
              onChange={(e) => setLocationValue(e.target.value)}
              placeholder={locationType === "in_person" ? "Address or room" : locationType === "phone" ? "Phone number" : "https://zoom.us/j/…"}
            />
          )}
        </div>
        {targets && targets.length > 1 && (
          <div>
            <label className="label" htmlFor="nm-cal">Calendar</label>
            <select id="nm-cal" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              {targets.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="nm-guests">Guests</label>
          <textarea id="nm-guests" className="input" rows={2} value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="alex@example.com, sam@example.com" />
          <p className="help">Guests receive a calendar invitation.</p>
        </div>
        <div>
          <label className="label" htmlFor="nm-desc">Description</label>
          <textarea id="nm-desc" className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <p className="text-xs text-faint">Times are in {tz.replace(/_/g, " ")}.</p>
        {error && <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary">{busy ? "Creating…" : "Create meeting"}</button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
