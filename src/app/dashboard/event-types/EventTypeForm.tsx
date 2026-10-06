"use client";

import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LocationOption, Question } from "@/db/schema";
import { LOCATION_TYPES, locationLabel } from "@/lib/locations";
import { EMPTY_PREFERENCES } from "@/lib/preferences";
import { WeeklyHoursEditor } from "@/components/WeeklyHoursEditor";
import { saveEventType, type EventTypeInput } from "../actions";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#475569"];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-sm text-faint">{desc}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  help,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  help?: string;
  min?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" min={min} className="input w-28" value={value} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="text-sm text-faint">{suffix}</span>}
      </div>
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function EventTypeForm({
  initial,
  schedules,
  username,
  targets,
  defaultTarget,
}: {
  initial: EventTypeInput;
  schedules: { id: number; name: string; isDefault: boolean }[];
  username: string;
  targets: { value: string; label: string; onlineMeetings: boolean }[];
  defaultTarget: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<EventTypeInput>(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [durationDraft, setDurationDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const set = <K extends keyof EventTypeInput>(k: K, val: EventTypeInput[K]) => {
    setV((prev) => ({ ...prev, [k]: val }));
    setSaved(false);
  };

  function updateLocation(i: number, loc: LocationOption) {
    set("locations", v.locations.map((l, j) => (j === i ? loc : l)));
  }

  function newLocation(type: LocationOption["type"]): LocationOption {
    switch (type) {
      case "online":
        return { type };
      case "in_person":
        return { type, address: "" };
      case "phone_host_calls":
        return { type };
      case "phone_invitee_calls":
        return { type, phone: "" };
      case "custom_link":
        return { type, url: "", label: "" };
    }
  }

  function updateQuestion(i: number, q: Partial<Question>) {
    set("questions", v.questions.map((x, j) => (j === i ? { ...x, ...q } : x)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await saveEventType(v);
      if (r.error) {
        setError(r.error);
        return;
      }
      setSaved(true);
      if (!v.id && r.id) router.replace(`/dashboard/event-types/${r.id}`);
      else router.refresh();
    });
  }

  const isGroup = v.seats > 1;
  const prefs = v.preferences ?? EMPTY_PREFERENCES;
  const setPrefs = (patch: Partial<typeof prefs>) => set("preferences", { ...prefs, ...patch });

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="Basics">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input
            id="title"
            className="input"
            required
            value={v.title}
            onChange={(e) => {
              set("title", e.target.value);
              if (!slugTouched) set("slug", slugify(e.target.value));
            }}
            placeholder="Office hours"
          />
        </div>
        <div>
          <label className="label" htmlFor="slug">URL</label>
          <div className="flex items-center rounded-lg border border-line-strong bg-paper text-sm focus-within:border-accent">
            <span className="pl-3 text-faint">/{username}/</span>
            <input
              id="slug"
              className="w-full rounded-r-lg bg-well px-2 py-2 focus:outline-none"
              required
              value={v.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", slugify(e.target.value));
              }}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="desc">Description</label>
          <textarea id="desc" className="input" rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="What is this meeting about?" />
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("color", c)}
                className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-canvas ${v.color === c ? "ring-2 ring-ink" : ""}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Duration" desc="Offer one length, or several and let invitees choose.">
        <div className="flex flex-wrap items-center gap-2">
          {v.durations.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent-soft">
              {d} min
              {v.durations.length > 1 && (
                <button type="button" className="ml-1 text-accent-soft/70 hover:text-accent-soft" onClick={() => set("durations", v.durations.filter((x) => x !== d))} aria-label={`Remove ${d} minutes`}>
                  <X size={14} />
                </button>
              )}
            </span>
          ))}
          {[15, 30, 45, 60, 90].filter((d) => !v.durations.includes(d)).map((d) => (
            <button key={d} type="button" className="rounded-full border border-dashed border-line-strong px-3 py-1 text-sm text-faint hover:border-line-strong" onClick={() => set("durations", [...v.durations, d].sort((a, b) => a - b))}>
              + {d}
            </button>
          ))}
          <input
            type="number"
            min={5}
            placeholder="Custom"
            className="input w-24 py-1"
            value={durationDraft}
            onChange={(e) => setDurationDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const n = Number(durationDraft);
                if (n >= 5 && !v.durations.includes(n)) set("durations", [...v.durations, n].sort((a, b) => a - b));
                setDurationDraft("");
              }
            }}
          />
        </div>
      </Section>

      <Section title="Location" desc="Where the meeting happens. Add more than one to let the invitee choose.">
        {v.locations.map((l, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-line p-3">
            <div className="flex gap-2">
              <select
                className="input"
                value={l.type}
                onChange={(e) => updateLocation(i, newLocation(e.target.value as LocationOption["type"]))}
              >
                {LOCATION_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>{t.label}</option>
                ))}
              </select>
              {v.locations.length > 1 && (
                <button type="button" className="btn-ghost" onClick={() => set("locations", v.locations.filter((_, j) => j !== i))}>Remove</button>
              )}
            </div>
            <p className="help">{LOCATION_TYPES.find((t) => t.type === l.type)?.hint}</p>
            {l.type === "in_person" && (
              <input className="input" placeholder="Address, building, room…" value={l.address} onChange={(e) => updateLocation(i, { ...l, address: e.target.value })} />
            )}
            {l.type === "phone_invitee_calls" && (
              <input className="input" placeholder="Your phone number" value={l.phone} onChange={(e) => updateLocation(i, { ...l, phone: e.target.value })} />
            )}
            {l.type === "custom_link" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="input" placeholder="https://zoom.us/j/…" value={l.url} onChange={(e) => updateLocation(i, { ...l, url: e.target.value })} />
                <input className="input" placeholder="Label (e.g. Zoom)" value={l.label ?? ""} onChange={(e) => updateLocation(i, { ...l, label: e.target.value })} />
              </div>
            )}
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => set("locations", [...v.locations, { type: "in_person", address: "" }])}>
          + Add location option
        </button>
      </Section>

      <Section title="Availability" desc="Which hours this event can be booked in.">
        <div>
          <label className="label" htmlFor="schedule">Schedule</label>
          <select id="schedule" className="input" value={v.scheduleId ?? ""} onChange={(e) => set("scheduleId", e.target.value ? Number(e.target.value) : null)}>
            <option value="">Default schedule</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.isDefault ? " (default)" : ""}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Minimum notice" value={Math.round(v.minNotice / 60 * 100) / 100} onChange={(n) => set("minNotice", Math.round(n * 60))} suffix="hours" help="How soon before a meeting people can book." />
          <NumberField label="Booking window" value={v.maxDaysAhead} onChange={(n) => set("maxDaysAhead", n)} suffix="days into the future" min={1} />
          <NumberField label="Buffer before" value={v.bufferBefore} onChange={(n) => set("bufferBefore", n)} suffix="min" help="Free time kept before each meeting." />
          <NumberField label="Buffer after" value={v.bufferAfter} onChange={(n) => set("bufferAfter", n)} suffix="min" />
          <div>
            <label className="label">Start times every</label>
            <select className="input w-40" value={v.slotInterval ?? ""} onChange={(e) => set("slotInterval", e.target.value ? Number(e.target.value) : null)}>
              <option value="">Event length</option>
              {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((n) => (
                <option key={n} value={n}>{n} min</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Max bookings per day</label>
            <input type="number" min={1} className="input w-28" placeholder="No limit" value={v.dailyLimit ?? ""} onChange={(e) => set("dailyLimit", e.target.value ? Number(e.target.value) : null)} />
          </div>
        </div>
      </Section>

      <Section title="Calendar" desc="Which calendar the booked meetings are added to.">
        <div>
          <label className="label" htmlFor="write-target">Add bookings to</label>
          <select id="write-target" className="input" value={v.writeTarget ?? ""} onChange={(e) => set("writeTarget", e.target.value || null)}>
            <option value="">Default ({defaultTarget})</option>
            {targets.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {v.locations.some((l) => l.type === "online") && targets.find((t) => t.value === (v.writeTarget ?? ""))?.onlineMeetings === false && (
            <p className="help">This calendar can&apos;t add video-call links automatically; invitees will be told the host shares the link.</p>
          )}
        </div>
      </Section>

      <Section title="Preferences" desc="Soft preferences shown to invitees. Every available time stays bookable; preferred ones are just highlighted.">
        {v.locations.length > 1 && (
          <div>
            <label className="label" htmlFor="pref-loc">Preferred location</label>
            <select id="pref-loc" className="input sm:w-80" value={prefs.locationIndex ?? ""} onChange={(e) => setPrefs({ locationIndex: e.target.value === "" ? null : Number(e.target.value) })}>
              <option value="">No preference</option>
              {v.locations.map((l, i) => (
                <option key={i} value={i}>{locationLabel(l)}{l.type === "in_person" && l.address ? `: ${l.address}` : ""}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={prefs.weekly !== null} onChange={(e) => setPrefs({ weekly: e.target.checked ? { "1": [{ start: "09:00", end: "12:00" }] } : null })} />
            Mark some times as preferred
          </label>
          {prefs.weekly !== null && (
            <div className="mt-3 rounded-xl border border-line px-4">
              <WeeklyHoursEditor weekly={prefs.weekly} onChange={(w) => setPrefs({ weekly: w })} offLabel="No preference" defaultRange={{ start: "09:00", end: "12:00" }} />
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="pref-note">Note to invitees</label>
          <input id="pref-note" className="input" maxLength={200} placeholder="e.g. Mornings are best; Tuesdays ideal" value={prefs.note} onChange={(e) => setPrefs({ note: e.target.value })} />
        </div>
      </Section>

      <Section title="Event kind">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-3 rounded-lg border border-line p-4 has-[:checked]:border-accent has-[:checked]:bg-accent/15">
            <input type="radio" checked={!isGroup} onChange={() => set("seats", 1)} />
            <div>
              <div className="font-medium">One-on-one</div>
              <div className="text-sm text-faint">One invitee per time slot.</div>
            </div>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-line p-4 has-[:checked]:border-accent has-[:checked]:bg-accent/15">
            <input type="radio" checked={isGroup} onChange={() => set("seats", Math.max(v.seats, 5))} />
            <div>
              <div className="font-medium">Group</div>
              <div className="text-sm text-faint">Several invitees join the same slot (office hours, workshops).</div>
            </div>
          </label>
        </div>
        {isGroup && <NumberField label="Seats per slot" value={v.seats} onChange={(n) => set("seats", Math.max(2, n))} min={2} help="Everyone in a slot shares one calendar event and Meet link." />}
      </Section>

      <Section title="Invitee questions" desc="Name, email and notes are always asked. Add your own questions here.">
        {v.questions.map((q, i) => (
          <div key={q.id} className="space-y-2 rounded-lg border border-line p-3">
            <div className="flex flex-wrap gap-2">
              <input className="input flex-1" placeholder="Question" value={q.label} onChange={(e) => updateQuestion(i, { label: e.target.value })} />
              <select className="input w-36" value={q.type} onChange={(e) => updateQuestion(i, { type: e.target.value as Question["type"] })}>
                <option value="text">Short text</option>
                <option value="textarea">Long text</option>
                <option value="phone">Phone</option>
                <option value="select">Dropdown</option>
              </select>
            </div>
            {q.type === "select" && (
              <input
                className="input"
                placeholder="Options, separated by commas"
                value={(q.options ?? []).join(", ")}
                onChange={(e) => updateQuestion(i, { options: e.target.value.split(",").map((s) => s.trimStart()) })}
                onBlur={(e) => updateQuestion(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            )}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(i, { required: e.target.checked })} /> Required
              </label>
              <button type="button" className="btn-ghost py-1 text-danger" onClick={() => set("questions", v.questions.filter((_, j) => j !== i))}>Remove</button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => set("questions", [...v.questions, { id: Math.random().toString(36).slice(2, 10), label: "", type: "text", required: false }])}
        >
          + Add question
        </button>
      </Section>

      <Section title="Visibility">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} />
          Accepting bookings
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={v.hidden} onChange={(e) => set("hidden", e.target.checked)} />
          Secret event: hide it from your profile page so only people with the link can book
        </label>
      </Section>

      <div className="sticky bottom-0 -mx-6 flex items-center gap-3 border-t border-line bg-canvas/90 px-6 py-4 backdrop-blur">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save"}</button>
        {saved && <span className="inline-flex items-center gap-1 text-sm text-success"><Check size={15} /> Saved</span>}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </form>
  );
}
