"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WeeklyHours } from "@/db/schema";
import { Dori } from "@/components/Dori";
import { Switch } from "@/components/Switch";
import { WeeklyHoursEditor } from "@/components/WeeklyHoursEditor";
import { saveDoriPrefs, saveWorkHours, setDoriEnabled } from "../dori-actions";

/** Dori on or off, what she calls you, and the hours when work can be planned. */
export function DoriSettings({ available, enabled, nickname, workHours, availabilityHours }: { available: boolean; enabled: boolean; nickname: string; workHours: WeeklyHours | null; availabilityHours: WeeklyHours }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(nickname);
  const [own, setOwn] = useState(!!workHours);
  const [hours, setHours] = useState<WeeklyHours>(workHours ?? availabilityHours);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: ok });
      router.refresh();
    });

  return (
    <section className="card space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Dori mood={enabled ? "happy" : "sleeping"} size={56} />
          <div>
            <h2 className="font-semibold">Dori, your assistant</h2>
            <p className="max-w-lg text-sm text-faint">
              Tell Dori what&apos;s on your plate; she builds your projects and tasks, plans them around your calendar, and
              answers questions in any language. {available ? "" : "Not available on this instance (no AI provider set up)."}
            </p>
          </div>
        </div>
        {available && (
          <Switch
            checked={enabled}
            disabled={pending}
            label={enabled ? "Turn Dori off" : "Turn Dori on"}
            onChange={(on) => {
              if (!on && !confirm("Turn Dori off? This deletes your conversation with her and the notes she kept. Your tasks stay.")) return;
              run(() => setDoriEnabled(on), on ? "Dori is on. Open her from the button at the bottom right." : "Dori is off.");
            }}
          />
        )}
      </div>

      {available && enabled && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveDoriPrefs({ nickname: name }), "Saved.");
          }}
        >
          <div>
            <label className="label" htmlFor="dori-nick">What Dori calls you</label>
            <input id="dori-nick" className="input w-56" maxLength={40} placeholder="Your first name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn-secondary" disabled={pending}>Save</button>
        </form>
      )}

      <div className="border-t border-line pt-5">
        <h3 className="font-semibold">Hours for planned work</h3>
        <p className="text-sm text-faint">When DoorCal may place your tasks. By default it uses the hours people can book you.</p>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={own} onChange={(e) => setOwn(e.target.checked)} /> Use different hours for my own work
        </label>
        {own && (
          <div className="mt-2">
            <WeeklyHoursEditor weekly={hours} onChange={setHours} offLabel="No planned work" />
          </div>
        )}
        <button className="btn-secondary mt-3" disabled={pending} onClick={() => run(() => saveWorkHours(own ? hours : null), "Work hours saved. Your plan is being updated.")}>
          Save hours
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </section>
  );
}
