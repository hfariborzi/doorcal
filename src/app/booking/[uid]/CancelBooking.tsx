"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelBooking({ uid }: { uid: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bookings/${uid}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not cancel");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-danger">
        Cancel
      </button>
    );

  return (
    <div className="w-full space-y-3 rounded-xl border border-danger/25 bg-danger/5 p-4 text-left">
      <label className="label" htmlFor="reason">Reason for cancelling (optional)</label>
      <textarea id="reason" className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button onClick={cancel} disabled={busy} className="btn bg-red-600 text-white hover:bg-red-500">
          {busy ? "Cancelling…" : "Confirm cancellation"}
        </button>
        <button onClick={() => setOpen(false)} className="btn-ghost">Keep booking</button>
      </div>
    </div>
  );
}
