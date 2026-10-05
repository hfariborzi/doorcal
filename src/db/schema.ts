import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export type TimeRange = { start: string; end: string }; // "09:00" - "17:00"
export type WeeklyHours = Record<string, TimeRange[]>; // keys "1".."7" (Mon..Sun, ISO weekday)
export type DateOverride = { date: string; ranges: TimeRange[] }; // empty ranges = unavailable all day

export type LocationOption =
  | { type: "google_meet" }
  | { type: "in_person"; address: string }
  | { type: "phone_host_calls" } // invitee provides their number
  | { type: "phone_invitee_calls"; phone: string }
  | { type: "custom_link"; url: string; label?: string };

export type Question = {
  id: string;
  label: string;
  type: "text" | "textarea" | "phone" | "select";
  required: boolean;
  options?: string[];
};

export type BookingLocation = { type: LocationOption["type"]; value?: string };

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    image: text("image"),
    username: text("username").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    headline: text("headline").notNull().default(""),
    welcome: text("welcome").notNull().default(""),
    brandColor: text("brand_color").notNull().default("#2563eb"),
    googleSub: text("google_sub").notNull(),
    googleRefreshToken: text("google_refresh_token"), // encrypted
    googleScopes: text("google_scopes"),
    writeCalendarId: text("write_calendar_id").notNull().default("primary"),
    conflictCalendarIds: jsonb("conflict_calendar_ids").$type<string[]>().notNull().default(["primary"]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_username_idx").on(t.username),
    uniqueIndex("users_google_sub_idx").on(t.googleSub),
  ],
);

export const schedules = pgTable(
  "schedules",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    weekly: jsonb("weekly").$type<WeeklyHours>().notNull(),
    overrides: jsonb("overrides").$type<DateOverride[]>().notNull().default([]),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [index("schedules_user_idx").on(t.userId)],
);

export const eventTypes = pgTable(
  "event_types",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    durations: jsonb("durations").$type<number[]>().notNull().default([30]),
    locations: jsonb("locations").$type<LocationOption[]>().notNull().default([{ type: "google_meet" }]),
    color: text("color").notNull().default("#2563eb"),
    scheduleId: integer("schedule_id").references(() => schedules.id, { onDelete: "set null" }),
    bufferBefore: integer("buffer_before").notNull().default(0),
    bufferAfter: integer("buffer_after").notNull().default(0),
    minNotice: integer("min_notice").notNull().default(240), // minutes
    maxDaysAhead: integer("max_days_ahead").notNull().default(60),
    slotInterval: integer("slot_interval"), // minutes; null = use duration
    dailyLimit: integer("daily_limit"), // null = unlimited
    seats: integer("seats").notNull().default(1), // >1 = group event
    questions: jsonb("questions").$type<Question[]>().notNull().default([]),
    hidden: boolean("hidden").notNull().default(false), // secret: not listed on profile
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("event_types_user_slug_idx").on(t.userId, t.slug)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    uid: text("uid").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventTypeId: integer("event_type_id").references(() => eventTypes.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    start: timestamp("start", { withTimezone: true }).notNull(),
    end: timestamp("end", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    guests: jsonb("guests").$type<string[]>().notNull().default([]),
    notes: text("notes").notNull().default(""),
    answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
    location: jsonb("location").$type<BookingLocation>().notNull(),
    meetLink: text("meet_link"),
    calendarId: text("calendar_id"),
    googleEventId: text("google_event_id"),
    status: text("status").$type<"confirmed" | "cancelled">().notNull().default("confirmed"),
    cancelReason: text("cancel_reason"),
    cancelledBy: text("cancelled_by").$type<"host" | "invitee">(),
    rescheduledFrom: text("rescheduled_from"),
    // One-on-one bookings can't overlap; the bookings_no_overlap exclusion constraint (migration 0001)
    // enforces it in the database. Group bookings share a time slot, so they are not exclusive.
    exclusive: boolean("exclusive").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("bookings_uid_idx").on(t.uid),
    index("bookings_user_start_idx").on(t.userId, t.start),
  ],
);

// Fixed-window request counters for the public endpoints (see src/lib/rate-limit.ts).
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export type User = typeof users.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
