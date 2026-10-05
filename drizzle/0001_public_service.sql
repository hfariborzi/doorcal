CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "exclusive" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Hand-written (Drizzle can't express exclusion constraints): no two confirmed one-on-one bookings of the
-- same host may overlap. This closes the race where two people book the same slot at the same moment.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
UPDATE "bookings" SET "exclusive" = false FROM "event_types" WHERE "bookings"."event_type_id" = "event_types"."id" AND "event_types"."seats" > 1;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("user_id" WITH =, tstzrange("start", "end") WITH &&) WHERE ("status" = 'confirmed' AND "exclusive");
