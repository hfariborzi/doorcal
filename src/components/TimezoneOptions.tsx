"use client";

import { useSyncExternalStore } from "react";

let cached: string[] | null = null;

function browserZones(): string[] {
  if (!cached) {
    try {
      cached = (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
    } catch {
      cached = [];
    }
    if (!cached.includes("UTC")) cached = [...cached, "UTC"];
  }
  return cached;
}

const noopSubscribe = () => () => {};

/**
 * <option>s for a time-zone <select>. The server and the browser ship different time-zone lists, so the
 * server renders only the selected zone and the browser fills in its own list after hydration.
 */
export function TimezoneOptions({ value }: { value: string }) {
  const zones = useSyncExternalStore(noopSubscribe, browserZones, () => null);
  const list = zones ? (zones.includes(value) ? zones : [value, ...zones]) : [value];
  return list.map((z) => (
    <option key={z} value={z}>
      {z.replace(/_/g, " ")}
    </option>
  ));
}
