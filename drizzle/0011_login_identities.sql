CREATE TABLE "login_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"private_email" boolean DEFAULT false NOT NULL,
	"refresh_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_identities" ADD CONSTRAINT "login_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "login_identities_provider_subject_idx" ON "login_identities" USING btree ("provider","subject");--> statement-breakpoint
CREATE INDEX "login_identities_user_idx" ON "login_identities" USING btree ("user_id");