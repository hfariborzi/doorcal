/**
 * Pure helpers for event categories, priorities and locations (no I/O; unit tested).
 */
import type { EventLocationKind, LabelRule, Priority } from "@/db/schema";

/** Ten colours that stay distinguishable on the dark canvas; a category picks one. */
export const CATEGORY_PALETTE = [
  "#8b5cf6", // violet
  "#22c55e", // green
  "#f59e0b", // amber
  "#38bdf8", // sky
  "#f472b6", // pink
  "#f97316", // orange
  "#2dd4bf", // teal
  "#a3e635", // lime
  "#c084fc", // lavender
  "#fb7185", // rose
];

export const MAX_CATEGORIES = 10;
export const MAX_RULES = 200;

export const PRIORITIES: Priority[] = ["high", "normal", "low"];
export const PRIORITY_LABEL: Record<Priority, string> = { high: "High", normal: "Normal", low: "Low" };
export const PRIORITY_COLOR: Record<Priority, string> = { high: "#fb7185", normal: "#8b5cf6", low: "#64748b" };

export const LOCATION_KINDS: EventLocationKind[] = ["video", "in_person", "unspecified"];
export const LOCATION_KIND_LABEL: Record<EventLocationKind, string> = { video: "Video", in_person: "In person", unspecified: "No location" };

/** Default set for a user who has not made their own. */
export const STARTER_CATEGORIES: { name: string; color: string; defaultPriority: Priority }[] = [
  { name: "Team", color: CATEGORY_PALETTE[0], defaultPriority: "normal" },
  { name: "1:1", color: CATEGORY_PALETTE[1], defaultPriority: "normal" },
  { name: "Teaching", color: CATEGORY_PALETTE[2], defaultPriority: "high" },
  { name: "Research", color: CATEGORY_PALETTE[3], defaultPriority: "high" },
  { name: "Personal", color: CATEGORY_PALETTE[4], defaultPriority: "low" },
  { name: "Health", color: CATEGORY_PALETTE[6], defaultPriority: "normal" },
  { name: "Admin", color: CATEGORY_PALETTE[9], defaultPriority: "low" },
];

export function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/** One label covers a whole recurring series. */
export function eventKey(e: { id: string; seriesId?: string }) {
  return e.seriesId || e.id;
}

/** Where an event happens, read from the event itself (no model needed). */
export function locationKind(e: { meetLink?: string; location?: string }): EventLocationKind {
  if (e.meetLink) return "video";
  if (e.location && /^https?:\/\//i.test(e.location.trim())) return "video";
  if (e.location?.trim()) return "in_person";
  return "unspecified";
}

/** First rule whose pattern appears in the title, case-insensitively, in position order. */
export function matchRule<R extends Pick<LabelRule, "pattern" | "position" | "id">>(rules: R[], title: string): R | null {
  const t = normalizeTitle(title);
  const ordered = [...rules].sort((a, b) => a.position - b.position || a.id - b.id);
  return ordered.find((r) => t.includes(normalizeTitle(r.pattern))) ?? null;
}

/** The label's own priority, else the category's default, else normal. */
export function effectivePriority(label: { priority: Priority | null } | null, category: { defaultPriority: Priority } | null): Priority {
  return label?.priority ?? category?.defaultPriority ?? "normal";
}

export function isPriority(v: unknown): v is Priority {
  return typeof v === "string" && (PRIORITIES as string[]).includes(v);
}
