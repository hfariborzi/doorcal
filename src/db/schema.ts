import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  type AnyPgColumn,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export type TimeRange = { start: string; end: string }; // "09:00" - "17:00"
export type WeeklyHours = Record<string, TimeRange[]>; // keys "1".."7" (Mon..Sun, ISO weekday)
export type DateOverride = { date: string; ranges: TimeRange[] }; // empty ranges = unavailable all day

export type Provider = "google" | "microsoft";

export type LocationOption =
  | { type: "online" } // video call; the link (Google Meet or Microsoft Teams) comes from the booking calendar
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
    writeCalendarId: text("write_calendar_id").notNull().default("primary"),
    // Default calendar account that receives new bookings (event types can override it).
    writeAccountId: integer("write_account_id").references((): AnyPgColumn => calendarAccounts.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_username_idx").on(t.username)],
);

/**
 * A connected Google or Microsoft account. A user can connect several; signing in with any of them opens the
 * same DoorCal account. `refreshToken` is encrypted; null means access was revoked and the user must reconnect.
 * "primary" in calendar ids means the account's default calendar, whatever the provider calls it.
 */
export const calendarAccounts = pgTable(
  "calendar_accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").$type<Provider>().notNull(),
    providerAccountId: text("provider_account_id").notNull(), // Google `sub`; Microsoft `tid:oid`
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    refreshToken: text("refresh_token"), // encrypted
    scopes: text("scopes"),
    conflictCalendarIds: jsonb("conflict_calendar_ids").$type<string[]>().notNull().default(["primary"]),
    // Whether the provider can attach a video-call link to events (Teams needs a work or school account).
    onlineMeetings: boolean("online_meetings").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("calendar_accounts_provider_account_idx").on(t.provider, t.providerAccountId),
    index("calendar_accounts_user_idx").on(t.userId),
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
    locations: jsonb("locations").$type<LocationOption[]>().notNull().default([{ type: "online" }]),
    color: text("color").notNull().default("#2563eb"),
    scheduleId: integer("schedule_id").references(() => schedules.id, { onDelete: "set null" }),
    // Where bookings of this type go; null means the user's default account and calendar.
    writeAccountId: integer("write_account_id").references(() => calendarAccounts.id, { onDelete: "set null" }),
    writeCalendarId: text("write_calendar_id"),
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
    meetLink: text("meet_link"), // Google Meet or Microsoft Teams join link
    accountId: integer("account_id").references(() => calendarAccounts.id, { onDelete: "set null" }),
    calendarId: text("calendar_id"),
    eventId: text("event_id"), // the event's id at the provider
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
export type CalendarAccount = typeof calendarAccounts.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
