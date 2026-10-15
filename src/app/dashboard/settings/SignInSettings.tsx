"use client";

import { useState, useTransition } from "react";
import { AppleButton } from "@/components/AppleButton";
import { unlinkAppleAction } from "../actions";

/**
 * Sign in with Apple as an extra way into this account (useful on iPhone). Google and Microsoft accounts are
 * listed under Connected calendars, and any of them can sign in too.
 */
export function SignInSettings({ apple, linkedEmail, privateEmail, flash }: { apple: boolean; linkedEmail: string | null; privateEmail: boolean; flash: string | null }) {
  const [linked, setLinked] = useState(linkedEmail !== null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!apple && !linked) return null;
  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Sign-in methods</h2>
      <p className="mt-1 text-sm text-muted">Any of your Google or Microsoft accounts above signs you in. You can also sign in with Apple.</p>
      {flash && <p className="mt-3 rounded-md bg-success/10 px-3 py-2 text-sm text-success">{flash}</p>}
      {error && <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {linked ? (
          <>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium text-ink">Apple</div>
              <div className="truncate text-xs text-faint">{privateEmail ? "Signed in with a hidden email address" : linkedEmail || "Linked"}</div>
            </div>
            <button
              type="button"
              className="btn-ghost py-1.5 text-sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await unlinkAppleAction();
                  if (r.error) setError(r.error);
                  else setLinked(false);
                })
              }
            >
              Unlink
            </button>
          </>
        ) : (
          <AppleButton compact link label="Link Sign in with Apple" />
        )}
      </div>
    </section>
  );
}
