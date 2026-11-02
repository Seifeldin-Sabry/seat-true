CREATE TABLE "integration_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"email" varchar(254) NOT NULL,
	"company" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "integration_waitlist_email_slug_idx" ON "integration_waitlist" USING btree ("email","slug");