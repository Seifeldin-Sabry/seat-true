CREATE TABLE "billing_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"line_count" integer NOT NULL,
	"unmapped_lines" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_imports" ADD CONSTRAINT "billing_imports_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_imports_organization_id_idx" ON "billing_imports" USING btree ("organization_id");