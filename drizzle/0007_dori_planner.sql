CREATE TABLE "calendar_watches" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"calendar_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"resource_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"day" text,
	"text" text NOT NULL,
	"avoid_energy" text,
	"skip_task_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reserve_for_task_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_work_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dori_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"message_id" integer NOT NULL,
	"undo" jsonb NOT NULL,
	"undone_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dori_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pinned_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"end" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"at_risk" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notices_seen_at" timestamp with time zone,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "dori_turns" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "voice_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "repeat" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dori_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dori_prefs" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "work_hours" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_dirty_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "calendar_watches" ADD CONSTRAINT "calendar_watches_account_id_calendar_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."calendar_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_notes" ADD CONSTRAINT "day_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dori_actions" ADD CONSTRAINT "dori_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dori_actions" ADD CONSTRAINT "dori_actions_message_id_dori_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."dori_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dori_messages" ADD CONSTRAINT "dori_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_blocks" ADD CONSTRAINT "pinned_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_blocks" ADD CONSTRAINT "pinned_blocks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_watches_channel_idx" ON "calendar_watches" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "calendar_watches_account_idx" ON "calendar_watches" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "day_notes_user_day_idx" ON "day_notes" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "dori_actions_message_idx" ON "dori_actions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "dori_messages_user_idx" ON "dori_messages" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "pinned_blocks_user_idx" ON "pinned_blocks" USING btree ("user_id");