"use client";

import { useState, useTransition } from "react";
import { Laptop, Smartphone } from "lucide-react";
import type { DevicePlatform } from "@/db/schema";
import { revokeDeviceAction } from "../actions";

const LABEL: Record<DevicePlatform, string> = { macos: "Mac", windows: "Windows", linux: "Linux", ios: "iPhone", android: "Android" };

type Device = { id: number; platform: DevicePlatform; name: string; createdAt: string; lastUsedAt: string | null };

/** The desktop and phone apps signed in to this account, each with Disconnect. */
export function DevicesSettings({ devices }: { devices: Device[] }) {
  const [list, setList] = useState(devices);
  const [pending, start] = useTransition();
  const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Apps and devices</h2>
      <p className="mt-1 text-sm text-muted">The Midore apps on your computers and phones. Disconnecting one signs it out and stops its widgets.</p>
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-faint">No apps signed in yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {list.map((d) => {
            const Icon = d.platform === "ios" || d.platform === "android" ? Smartphone : Laptop;
            return (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <Icon size={18} className="shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{d.name || `${LABEL[d.platform]} app`}</div>
                  <div className="text-xs text-faint">
                    {LABEL[d.platform]} · connected {day(d.createdAt)}
                    {d.lastUsedAt ? ` · last used ${day(d.lastUsedAt)}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost py-1.5 text-sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await revokeDeviceAction(d.id);
                      setList((l) => l.filter((x) => x.id !== d.id));
                    })
                  }
                >
                  Disconnect
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
