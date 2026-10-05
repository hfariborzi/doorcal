CREATE TABLE "calendar_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"refresh_token" text,
	"scopes" text,
	"conflict_calendar_ids" jsonb DEFAULT '["primary"]'::jsonb NOT NULL,
	"online_meetings" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "event_id" text;--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "write_account_id" integer;--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "write_calendar_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "write_account_id" integer;--> statement-breakpoint
ALTER TABLE "calendar_accounts" ADD CONSTRAINT "calendar_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_accounts_provider_account_idx" ON "calendar_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "calendar_accounts_user_idx" ON "calendar_accounts" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_account_id_calendar_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."calendar_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_write_account_id_calendar_accounts_id_fk" FOREIGN KEY ("write_account_id") REFERENCES "public"."calendar_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_write_account_id_calendar_accounts_id_fk" FOREIGN KEY ("write_account_id") REFERENCES "public"."calendar_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Hand-written data migration: each user's single Google connection becomes a calendar_accounts row.
INSERT INTO "calendar_accounts" ("user_id", "provider", "provider_account_id", "email", "name", "refresh_token", "scopes", "conflict_calendar_ids", "created_at")
SELECT "id", 'google', "google_sub", "email", "name", "google_refresh_token", "google_scopes", "conflict_calendar_ids", "created_at" FROM "users";--> statement-breakpoint
UPDATE "users" u SET "write_account_id" = a."id" FROM "calendar_accounts" a WHERE a."user_id" = u."id";--> statement-breakpoint
UPDATE "bookings" b SET "account_id" = u."write_account_id", "event_id" = b."google_event_id" FROM "users" u WHERE b."user_id" = u."id";--> statement-breakpoint
-- The "google_meet" location type becomes "online": the link comes from whichever calendar bookings go to.
UPDATE "event_types" SET "locations" = COALESCE((SELECT jsonb_agg(CASE WHEN l->>'type' = 'google_meet' THEN jsonb_set(l, '{type}', '"online"') ELSE l END) FROM jsonb_array_elements("locations") l), '[]'::jsonb);--> statement-breakpoint
UPDATE "bookings" SET "location" = jsonb_set("location", '{type}', '"online"') WHERE "location"->>'type' = 'google_meet';
