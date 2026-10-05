"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import type { CalendarListItem } from "@/lib/google";
import { deleteAccount, disconnectGoogle, saveCalendars, saveProfile } from "../actions";

function allTimezones(current: string) {
  let list: string[] = [];
  try {
    list = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {}
  if (!list.includes(current)) list = [current, ...list];
  return list;
}

function SaveBar({ pending, saved, error }: { pending: boolean; saved: boolean; error: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save"}</button>
      {saved && <span className="inline-flex items-center gap-1 text-sm text-success"><Check size={15} /> Saved</span>}
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}

export function ProfileForm({ initial }: { initial: { name: string; username: string; headline: string; welcome: string; timezone: string } }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v, val: string) => {
    setV({ ...v, [k]: val });
    setSaved(false);
  };

  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await saveProfile(v);
          if (r.error) setError(r.error);
          else setSaved(true);
        });
      }}
    >
      <h2 className="font-semibold">Profile</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="p-name">Display name</label>
          <input id="p-name" className="input" value={v.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="p-user">Username</label>
          <input id="p-user" className="input" value={v.username} onChange={(e) => set("username", e.target.value.toLowerCase())} />
          <p className="help">Your public link is /{v.username || "username"}. Changing it breaks old links.</p>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="p-head">Headline</label>
        <input id="p-head" className="input" placeholder="e.g. Associate Professor, Mount Royal University" value={v.headline} onChange={(e) => set("headline", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="p-welcome">Welcome message</label>
        <textarea id="p-welcome" className="input" rows={3} value={v.welcome} onChange={(e) => set("welcome", e.target.value)} placeholder="Shown on your booking page." />
      </div>
      <div>
        <label className="label" htmlFor="p-tz">Your time zone</label>
        <select id="p-tz" className="input sm:w-80" value={v.timezone} onChange={(e) => set("timezone", e.target.value)}>
          {allTimezones(v.timezone).map((z) => (
            <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
          ))}
        </select>
        <p className="help">Used for your dashboard. Each availability schedule has its own time zone.</p>
      </div>
      <SaveBar pending={pending} saved={saved} error={error} />
    </form>
  );
}

export function CalendarsForm({
  calendars,
  initial,
}: {
  calendars: CalendarListItem[];
  initial: { writeCalendarId: string; conflictCalendarIds: string[] };
}) {
  const [write, setWrite] = useState(initial.writeCalendarId);
  const [conflicts, setConflicts] = useState(new Set(initial.conflictCalendarIds));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await saveCalendars({ writeCalendarId: write, conflictCalendarIds: [...conflicts] });
          if (r.error) setError(r.error);
          else setSaved(true);
        });
      }}
    >
      <div>
        <h2 className="font-semibold">Calendars</h2>
        <p className="text-sm text-faint">Choose which calendars block your availability and where new bookings go.</p>
      </div>
      <div>
        <p className="label">Check these calendars for conflicts</p>
        <div className="space-y-2">
          {calendars.map((c) => (
            <label key={c.id} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={conflicts.has(c.id)}
                onChange={(e) => {
                  const next = new Set(conflicts);
                  if (e.target.checked) next.add(c.id);
                  else next.delete(c.id);
                  setConflicts(next);
                  setSaved(false);
                }}
              />
              <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} />
              {c.summary}
              {c.primary && <span className="text-xs text-faint">(primary)</span>}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="write-cal">Add new bookings to</label>
        <select id="write-cal" className="input sm:w-80" value={write} onChange={(e) => { setWrite(e.target.value); setSaved(false); }}>
          {calendars.filter((c) => c.canWrite).map((c) => (
            <option key={c.id} value={c.id}>{c.summary}</option>
          ))}
        </select>
      </div>
      <SaveBar pending={pending} saved={saved} error={error} />
    </form>
  );
}

export function DangerZone({ connected }: { connected: boolean }) {
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-4 border-danger/30 p-6">
      <h2 className="font-semibold text-danger">Danger zone</h2>
      {connected && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Disconnect Google Calendar. Nobody can book you until you reconnect.</p>
          <button
            className="btn-danger"
            disabled={pending}
            onClick={() => confirm("Disconnect Google Calendar?") && start(() => disconnectGoogle())}
          >
            Disconnect
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Delete your account, event types and booking history. Events already on your Google Calendar stay there.</p>
        <button
          className="btn bg-red-600 text-white hover:bg-red-500"
          disabled={pending}
          onClick={() => confirm("Permanently delete your account? This cannot be undone.") && start(() => deleteAccount())}
        >
          Delete account
        </button>
      </div>
    </section>
  );
}
