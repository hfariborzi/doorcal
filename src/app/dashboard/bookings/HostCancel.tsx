"use client";

import { useState, useTransition } from "react";
import { hostCancelBooking } from "../actions";

export function HostCancel({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-danger py-1.5">
        Cancel
      </button>
    );
  return (
    <div className="mt-2 w-full space-y-2">
      <textarea className="input" rows={2} placeholder="Reason (shared with the invitee)" value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={pending}
          className="btn bg-red-600 py-1.5 text-white hover:bg-red-500"
          onClick={() =>
            start(async () => {
              const r = await hostCancelBooking(uid, reason);
              if (r.error) setError(r.error);
            })
          }
        >
          {pending ? "Cancelling…" : "Cancel meeting"}
        </button>
        <button className="btn-ghost py-1.5" onClick={() => setOpen(false)}>Keep</button>
      </div>
    </div>
  );
}
