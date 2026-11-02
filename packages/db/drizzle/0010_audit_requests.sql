CREATE TABLE "audit_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"company" varchar(160) NOT NULL,
	"clients" varchar(16) NOT NULL,
	"distributor" varchar(32) NOT NULL,
	"psa" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_requests_email_unique" UNIQUE("email")
);
