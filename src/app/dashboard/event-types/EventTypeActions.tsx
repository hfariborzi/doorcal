"use client";

import { useTransition } from "react";
import { Copy, Trash2 } from "lucide-react";
import { deleteEventType, duplicateEventType, toggleEventType } from "../actions";
import { Switch } from "@/components/Switch";

export function EventTypeActions({ id, active }: { id: number; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <>
      <Switch
        checked={active}
        disabled={pending}
        onChange={(on) => start(() => toggleEventType(id, on))}
        label={active ? "Accepting bookings" : "Not accepting bookings"}
      />
      <button className="btn-ghost px-2.5 py-1.5" disabled={pending} onClick={() => start(() => duplicateEventType(id))} title="Duplicate">
        <Copy size={15} /> <span className="sr-only sm:not-sr-only">Duplicate</span>
      </button>
      <button
        className="btn-ghost px-2.5 py-1.5 text-danger hover:text-danger"
        disabled={pending}
        title="Delete"
        onClick={() => confirm("Delete this event type? Existing bookings are kept.") && start(() => deleteEventType(id))}
      >
        <Trash2 size={15} /> <span className="sr-only">Delete</span>
      </button>
    </>
  );
}
