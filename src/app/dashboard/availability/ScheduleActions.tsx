"use client";

import { useState, useTransition } from "react";
import { deleteSchedule, setDefaultSchedule } from "../actions";

export function ScheduleActions({ id, isDefault }: { id: number; isDefault: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isDefault && (
        <button className="btn-ghost py-1.5" disabled={pending} onClick={() => start(() => setDefaultSchedule(id))}>
          Make default
        </button>
      )}
      {!isDefault && (
        <button
          className="btn-ghost py-1.5 text-red-600"
          disabled={pending}
          onClick={() =>
            confirm("Delete this schedule? Event types using it will fall back to your default.") &&
            start(async () => {
              const r = await deleteSchedule(id);
              if (r.error) setError(r.error);
            })
          }
        >
          Delete
        </button>
      )}
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
