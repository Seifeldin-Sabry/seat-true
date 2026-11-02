CREATE TABLE "sku_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"alias_key" varchar(200) NOT NULL,
	"label" varchar(200) NOT NULL,
	"sku" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sku_aliases" ADD CONSTRAINT "sku_aliases_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sku_aliases_organization_key_idx" ON "sku_aliases" USING btree ("organization_id","alias_key");