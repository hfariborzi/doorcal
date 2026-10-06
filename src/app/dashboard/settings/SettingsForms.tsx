"use client";

import { AlertTriangle, Check, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import type { Provider } from "@/db/schema";
import type { CalendarListItem } from "@/lib/calendar/types";
import { ProviderButton } from "@/components/ProviderButton";
import { deleteAccount, removeCalendarAccount, saveCalendarSettings, saveProfile } from "../actions";
import { TimezoneOptions } from "@/components/TimezoneOptions";

const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", microsoft: "Microsoft" };


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
          <TimezoneOptions value={v.timezone} />
        </select>
        <p className="help">Used for your dashboard. Each availability schedule has its own time zone.</p>
      </div>
      <SaveBar pending={pending} saved={saved} error={error} />
    </form>
  );
}

type AccountView = {
  id: number;
  provider: Provider;
  email: string;
  connected: boolean;
  onlineMeetings: boolean;
  conflictCalendarIds: string[];
  calendars: CalendarListItem[];
  error: string | null;
};

export function ConnectedCalendars({
  providers,
  accounts,
  initialWrite,
  flash,
}: {
  providers: Provider[];
  accounts: AccountView[];
  initialWrite: { accountId: number | null; calendarId: string };
  flash: { kind: "ok" | "error"; text: string } | null;
}) {
  const [conflicts, setConflicts] = useState(() => new Map(accounts.map((a) => [a.id, new Set(a.conflictCalendarIds)])));
  const writable = accounts.flatMap((a) => a.calendars.filter((c) => c.canWrite).map((c) => ({ value: `${a.id}:${c.id}`, label: `${a.email} › ${c.summary}` })));
  const initialValue = `${initialWrite.accountId}:${initialWrite.calendarId}`;
  const [write, setWrite] = useState(writable.some((w) => w.value === initialValue) ? initialValue : (writable[0]?.value ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function toggle(accountId: number, calendarId: string, on: boolean) {
    const next = new Map(conflicts);
    const set = new Set(next.get(accountId));
    if (on) set.add(calendarId);
    else set.delete(calendarId);
    next.set(accountId, set);
    setConflicts(next);
    setSaved(false);
  }

  return (
    <section className="card space-y-6 p-6">
      <div>
        <h2 className="font-semibold">Connected calendars</h2>
        <p className="text-sm text-faint">
          Connect as many Google and Microsoft accounts as you like. Any of them can be used to sign in. Tick the
          calendars that should block your availability, and choose where new bookings go.
        </p>
      </div>
      {flash && (
        <p className={`rounded-lg px-3 py-2 text-sm ${flash.kind === "ok" ? "border border-success/30 bg-success/10 text-success" : "border border-danger/25 bg-danger/10 text-danger"}`}>
          {flash.text}
        </p>
      )}

      <ul className="divide-y divide-line border-y border-line">
        {accounts.map((a) => (
          <li key={a.id} className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-hover px-1.5 py-0.5 text-xs font-medium text-muted">{PROVIDER_LABEL[a.provider]}</span>
                  <span className="truncate font-medium text-ink">{a.email}</span>
                  {!a.connected && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning">
                      <AlertTriangle size={12} /> Needs reconnecting
                    </span>
                  )}
                </div>
                {a.provider === "microsoft" && !a.onlineMeetings && (
                  <p className="help">Personal Microsoft account: video-call links can&apos;t be added automatically.</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!a.connected && <ProviderButton provider={a.provider} reconnect={a.id} label="Reconnect" compact />}
                <RemoveAccount id={a.id} email={a.email} only={accounts.length === 1} />
              </div>
            </div>
            {a.error && a.connected && <p className="mt-2 text-sm text-danger">{a.error}</p>}
            {a.calendars.length > 0 && (
              <div className="mt-3 space-y-2">
                {a.calendars.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={conflicts.get(a.id)?.has(c.id) ?? false}
                      onChange={(e) => toggle(a.id, c.id, e.target.checked)}
                    />
                    <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: c.color }} />
                    <span className="text-ink">{c.summary}</span>
                    {c.primary && <span className="text-xs text-faint">(main)</span>}
                    {!c.canReadEvents && <span className="text-xs text-faint">(free/busy only)</span>}
                  </label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {providers.map((p) => (
          <ProviderButton key={p} provider={p} connect label={`Connect ${PROVIDER_LABEL[p]} account`} compact />
        ))}
      </div>

      <form
        className="space-y-4 border-t border-line pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          // With no writable calendar loaded (e.g. every account needs reconnecting), keep the current default.
          const sep = write.indexOf(":");
          const writeAccountId = write ? Number(write.slice(0, sep)) : (initialWrite.accountId ?? accounts[0]?.id ?? 0);
          const writeCalendarId = write ? write.slice(sep + 1) : initialWrite.calendarId;
          start(async () => {
            const r = await saveCalendarSettings({
              accounts: accounts.map((a) => ({ id: a.id, conflictCalendarIds: [...(conflicts.get(a.id) ?? [])] })),
              writeAccountId,
              writeCalendarId,
            });
            if (r.error) setError(r.error);
            else setSaved(true);
          });
        }}
      >
        <div>
          <label className="label" htmlFor="write-cal">Add new bookings to</label>
          <select id="write-cal" className="input sm:w-96" value={write} onChange={(e) => { setWrite(e.target.value); setSaved(false); }} disabled={writable.length === 0}>
            {writable.length === 0 && <option value="">No writable calendar connected</option>}
            {writable.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
          <p className="help">Each event type can override this in its settings.</p>
        </div>
        <SaveBar pending={pending} saved={saved} error={error} />
      </form>
    </section>
  );
}

function RemoveAccount({ id, email, only }: { id: number; email: string; only: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="btn-ghost px-2.5 py-1.5 text-danger hover:text-danger"
        disabled={pending}
        title={only ? "Connect another account before removing this one" : "Remove this account"}
        onClick={() =>
          confirm(`Remove ${email} from DoorCal? Bookings already on its calendar stay there, but DoorCal can no longer update them.`) &&
          start(async () => {
            const r = await removeCalendarAccount(id);
            if (r.error) setError(r.error);
          })
        }
      >
        <Trash2 size={15} /> <span className="sr-only sm:not-sr-only">Remove</span>
      </button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </>
  );
}

export function DangerZone() {
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-4 border-danger/30 p-6">
      <h2 className="font-semibold text-danger">Danger zone</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Delete your account, event types and booking history, and revoke DoorCal&apos;s access to your calendars.
          Events already on your calendars stay there.
        </p>
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
