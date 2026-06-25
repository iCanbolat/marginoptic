CREATE TYPE "public"."ad_link_match_type" AS ENUM('auto', 'manual');--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'amazon_ads';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'ebay_ads';--> statement-breakpoint
CREATE TABLE "product_ad_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_external_id" varchar(255) NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"ad_entity_external_id" varchar(255) NOT NULL,
	"level" "ad_level" DEFAULT 'campaign' NOT NULL,
	"match_type" "ad_link_match_type" DEFAULT 'manual' NOT NULL,
	"weight" numeric(20, 4) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_ad_spend_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"date" date NOT NULL,
	"product_external_id" varchar(255) NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"spend" numeric(20, 4) DEFAULT '0' NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" numeric(20, 4) DEFAULT '0' NOT NULL,
	"conversion_value" numeric(20, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_traffic_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"date" date NOT NULL,
	"product_external_id" varchar(255) NOT NULL,
	"channel" varchar(32) NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"product_views" integer DEFAULT 0 NOT NULL,
	"purchases" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "tracking_key" varchar(128);--> statement-breakpoint
ALTER TABLE "product_ad_links" ADD CONSTRAINT "product_ad_links_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ad_spend_daily" ADD CONSTRAINT "product_ad_spend_daily_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_traffic_daily" ADD CONSTRAINT "product_traffic_daily_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_ad_link" ON "product_ad_links" USING btree ("store_id","product_external_id","provider","ad_entity_external_id");--> statement-breakpoint
CREATE INDEX "idx_product_ad_link_entity" ON "product_ad_links" USING btree ("store_id","provider","ad_entity_external_id");--> statement-breakpoint
CREATE INDEX "idx_product_ad_link_product" ON "product_ad_links" USING btree ("store_id","product_external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_ad_spend" ON "product_ad_spend_daily" USING btree ("store_id","provider","product_external_id","date");--> statement-breakpoint
CREATE INDEX "idx_product_ad_spend_store_date" ON "product_ad_spend_daily" USING btree ("store_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_traffic" ON "product_traffic_daily" USING btree ("store_id","channel","product_external_id","date");--> statement-breakpoint
CREATE INDEX "idx_product_traffic_store_date" ON "product_traffic_daily" USING btree ("store_id","date");