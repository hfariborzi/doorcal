"use client";

import { useTransition } from "react";
import { deleteEventType, duplicateEventType, toggleEventType } from "../actions";

export function EventTypeActions({ id, active }: { id: number; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={active} disabled={pending} onChange={(e) => start(() => toggleEventType(id, e.target.checked))} />
        {active ? "On" : "Off"}
      </label>
      <button className="btn-ghost py-1.5" disabled={pending} onClick={() => start(() => duplicateEventType(id))}>
        Duplicate
      </button>
      <button
        className="btn-ghost py-1.5 text-red-600"
        disabled={pending}
        onClick={() => confirm("Delete this event type? Existing bookings are kept.") && start(() => deleteEventType(id))}
      >
        Delete
      </button>
    </div>
  );
}
