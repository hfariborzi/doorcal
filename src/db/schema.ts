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

export type Priority = "high" | "normal" | "low";
export type EventLocationKind = "video" | "in_person" | "unspecified";
export type LabelSource = "user" | "rule" | "ai";

/** Dashboard calendar display choices. */
export type CalendarPrefs = {
  colorBy: "calendar" | "type" | "priority";
  hidden: { categories: number[]; other: boolean; locations: EventLocationKind[]; priorities: Priority[] };
  // Calendars shown in the dashboard, per account id. An account with no entry shows its conflict
  // calendars plus the one bookings go to. Separate from what blocks availability (Settings).
  calendars?: Record<string, string[]>;
};

/** Soft preferences shown to invitees; they never remove a slot. */
export type BookingPreferences = {
  locationIndex: number | null; // index into event_types.locations
  weekly: WeeklyHours | null; // preferred windows, in the schedule's time zone; null = no time preference
  note: string;
};

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
    calendarPrefs: jsonb("calendar_prefs").$type<CalendarPrefs>(),
    // When the user agreed to send event titles to the AI provider for categorisation; null = off.
    aiConsentAt: timestamp("ai_consent_at", { withTimezone: true }),
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

/**
 * The areas of a user's life: "Research", "Teaching", "Home". One list serves two purposes: it is the
 * "type" dimension the calendar is sorted into, and the top level that projects and tasks live under.
 * At most 20 per user.
 */
export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    description: text("description").notNull().default(""), // one line on what belongs here
    defaultPriority: text("default_priority").$type<Priority>().notNull().default("normal"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_user_name_idx").on(t.userId, t.name)],
);

/** "If the title contains X, it's category Y (and priority Z)". First match wins, in position order. */
export const labelRules = pgTable(
  "label_rules",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pattern: text("pattern").notNull(), // matched case-insensitively as a substring of the title
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "cascade" }), // null = Other
    priority: text("priority").$type<Priority>(), // null = the category's default
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("label_rules_user_idx").on(t.userId)],
);

/**
 * A label on one calendar event (or a whole recurring series). Only the label and a hash of the title are
 * stored, never the title itself. A label from a rule or the AI is redone when the title changes; a label
 * the user set by hand sticks.
 */
export const eventLabels = pgTable(
  "event_labels",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: integer("account_id")
      .notNull()
      .references(() => calendarAccounts.id, { onDelete: "cascade" }),
    eventKey: text("event_key").notNull(), // the series id for recurring events, else the event id
    titleHash: text("title_hash").notNull(),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }), // null = Other
    priority: text("priority").$type<Priority>(), // null = the category's default
    source: text("source").$type<LabelSource>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("event_labels_account_event_idx").on(t.accountId, t.eventKey), index("event_labels_user_idx").on(t.userId)],
);

/** AI classification counters, for per-user and instance-wide caps. */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // YYYY-MM-DD (UTC)
    events: integer("events").notNull().default(0),
    requests: integer("requests").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
  },
  (t) => [uniqueIndex("ai_usage_user_day_idx").on(t.userId, t.day)],
);

// --- Projects and tasks ------------------------------------------------------------------------------

export type ProjectStatus = "active" | "paused" | "done";
export type TaskKind = "task" | "reminder"; // a reminder is something to remember, never scheduled
export type TaskStatus = "open" | "good_enough" | "done" | "dropped";
export type TaskEnergy = "deep" | "light";
export type TaskLinkKind = "before" | "together"; // "from" finishes before "to" starts; or the two are done as one

/** A bounded effort inside an area, e.g. "JIBS revision" under Research. */
export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }), // null = no area
    name: text("name").notNull(),
    notes: text("notes").notNull().default(""),
    status: text("status").$type<ProjectStatus>().notNull().default("active"),
    targetDate: text("target_date"), // YYYY-MM-DD, optional
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

/**
 * One piece of work. "good_enough" means the job is mostly done and `residue` names the small part left;
 * it counts as complete, and the residue is collected in the Loose ends list.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
    // The area. Follows the project when there is one; set directly for a task that belongs to no project.
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    notes: text("notes").notNull().default(""),
    kind: text("kind").$type<TaskKind>().notNull().default("task"),
    status: text("status").$type<TaskStatus>().notNull().default("open"),
    residue: text("residue").notNull().default(""), // what is left when the task is "good enough"
    estimateMinutes: integer("estimate_minutes"), // null = unknown
    dueDate: text("due_date"), // YYYY-MM-DD, optional
    hardDeadline: boolean("hard_deadline").notNull().default(false), // a date that cannot move
    priority: text("priority").$type<Priority>().notNull().default("normal"),
    energy: text("energy").$type<TaskEnergy>(), // null = either
    people: jsonb("people").$type<string[]>().notNull().default([]), // who is involved; stays in DoorCal
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("tasks_user_status_idx").on(t.userId, t.status), index("tasks_project_idx").on(t.projectId)],
);

/** Ordering and grouping between tasks. */
export const taskLinks = pgTable(
  "task_links",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromTaskId: integer("from_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    toTaskId: integer("to_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    kind: text("kind").$type<TaskLinkKind>().notNull(),
  },
  (t) => [uniqueIndex("task_links_pair_idx").on(t.fromTaskId, t.toTaskId), index("task_links_user_idx").on(t.userId)],
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
    preferences: jsonb("preferences").$type<BookingPreferences>(),
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
export type Category = typeof categories.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskLink = typeof taskLinks.$inferSelect;
export type LabelRule = typeof labelRules.$inferSelect;
export type EventLabel = typeof eventLabels.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
