CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"user_id" integer NOT NULL,
	"event_type_id" integer,
	"title" text NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"end" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"guests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"location" jsonb NOT NULL,
	"meet_link" text,
	"calendar_id" text,
	"google_event_id" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"cancel_reason" text,
	"cancelled_by" text,
	"rescheduled_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"durations" jsonb DEFAULT '[30]'::jsonb NOT NULL,
	"locations" jsonb DEFAULT '[{"type":"google_meet"}]'::jsonb NOT NULL,
	"color" text DEFAULT '#2563eb' NOT NULL,
	"schedule_id" integer,
	"buffer_before" integer DEFAULT 0 NOT NULL,
	"buffer_after" integer DEFAULT 0 NOT NULL,
	"min_notice" integer DEFAULT 240 NOT NULL,
	"max_days_ahead" integer DEFAULT 60 NOT NULL,
	"slot_interval" integer,
	"daily_limit" integer,
	"seats" integer DEFAULT 1 NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"weekly" jsonb NOT NULL,
	"overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"image" text,
	"username" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"welcome" text DEFAULT '' NOT NULL,
	"brand_color" text DEFAULT '#2563eb' NOT NULL,
	"google_sub" text NOT NULL,
	"google_refresh_token" text,
	"google_scopes" text,
	"write_calendar_id" text DEFAULT 'primary' NOT NULL,
	"conflict_calendar_ids" jsonb DEFAULT '["primary"]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_uid_idx" ON "bookings" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "bookings_user_start_idx" ON "bookings" USING btree ("user_id","start");--> statement-breakpoint
CREATE UNIQUE INDEX "event_types_user_slug_idx" ON "event_types" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "schedules_user_idx" ON "schedules" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_sub_idx" ON "users" USING btree ("google_sub");