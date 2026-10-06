"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Provider } from "@/db/schema";
import { setVisibleCalendars } from "./actions";

type Account = {
  id: number;
  provider: Provider;
  email: string;
  connected: boolean;
  error: string | null;
  calendars: { id: string; name: string; color: string }[];
  visible: string[];
};

/** Fired after a calendar is shown or hidden so the calendar view reloads its events. */
export const CALENDARS_CHANGED = "doorcal:calendars-changed";

/**
 * The connected accounts and their calendars, each with a checkbox that shows or hides it in the
 * dashboard calendar. Display only: what blocks bookings is chosen in Settings.
 */
export function CalendarSidebar({ collapsible = false }: { collapsible?: boolean }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [open, setOpen] = useState(!collapsible);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calendar/list")
      .then((r) => r.json())
      .then((d: { accounts?: Account[] }) => !cancelled && setAccounts(d.accounts ?? []))
      .catch(() => !cancelled && setAccounts([]));
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(account: Account, calendarId: string, on: boolean) {
    const visible = on ? [...account.visible, calendarId] : account.visible.filter((c) => c !== calendarId);
    setAccounts((list) => (list ?? []).map((a) => (a.id === account.id ? { ...a, visible } : a)));
    void setVisibleCalendars(account.id, visible).then(() => window.dispatchEvent(new Event(CALENDARS_CHANGED)));
  }

  const heading = (
    <div className="flex items-center justify-between px-2">
      <span className="eyebrow">Calendars</span>
      {collapsible && <ChevronDown size={14} className={`text-faint transition ${open ? "rotate-180" : ""}`} />}
    </div>
  );

  return (
    <section className="mt-6 border-t border-line pt-4">
      {collapsible ? (
        <button type="button" onClick={() => setOpen(!open)} className="w-full text-left" aria-expanded={open}>
          {heading}
        </button>
      ) : (
        heading
      )}
      {open && (
        <div className="mt-2 space-y-3">
          {accounts === null && <p className="px-2 text-xs text-faint">Loading…</p>}
          {accounts?.map((a) => (
            <div key={a.id}>
              <p className="truncate px-2 text-xs text-faint" title={a.email}>{a.email}</p>
              {!a.connected && (
                <Link href="/dashboard/settings" className="block px-2 text-xs text-warning hover:underline">Needs reconnecting</Link>
              )}
              {a.connected && a.error && <p className="px-2 text-xs text-danger">{a.error}</p>}
              <ul className="mt-1">
                {a.calendars.map((c) => {
                  const on = a.visible.includes(c.id);
                  return (
                    <li key={c.id}>
                      <label className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 text-sm hover:bg-hover ${on ? "text-ink" : "text-faint"}`}>
                        <input type="checkbox" checked={on} onChange={(e) => toggle(a, c.id, e.target.checked)} className="sr-only" />
                        <span
                          className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-sm border"
                          style={{ borderColor: c.color, background: on ? c.color : "transparent" }}
                          aria-hidden
                        >
                          {on && <svg viewBox="0 0 10 10" width="9" height="9"><path d="M1.5 5.2 4 7.5 8.5 2.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {accounts && accounts.length === 0 && (
            <Link href="/dashboard/settings" className="block px-2 text-xs text-accent-soft hover:underline">Connect a calendar</Link>
          )}
          <p className="px-2 text-[11px] leading-snug text-faint">
            Show or hide here. Which calendars block bookings is set in <Link href="/dashboard/settings" className="underline">Settings</Link>.
          </p>
        </div>
      )}
    </section>
  );
}
