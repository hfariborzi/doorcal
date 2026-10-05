DROP INDEX "users_google_sub_idx";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "google_event_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "google_sub";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "google_refresh_token";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "google_scopes";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "conflict_calendar_ids";