CREATE TYPE "public"."ad_level" AS ENUM('account', 'campaign', 'adset', 'ad');--> statement-breakpoint
CREATE TABLE "ad_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"level" "ad_level" NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"name" varchar(500),
	"parent_external_id" varchar(255),
	"campaign_external_id" varchar(255),
	"status" varchar(32),
	"currency" varchar(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_spend" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"date" date NOT NULL,
	"level" "ad_level" NOT NULL,
	"entity_external_id" varchar(255) NOT NULL,
	"campaign_external_id" varchar(255),
	"name" varchar(500),
	"spend" numeric(20, 4) DEFAULT '0' NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" numeric(20, 4) DEFAULT '0' NOT NULL,
	"conversion_value" numeric(20, 4) DEFAULT '0' NOT NULL,
	"currency" varchar(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_entities" ADD CONSTRAINT "ad_entities_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_entities" ADD CONSTRAINT "ad_entities_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ad_entity_store_provider_external" ON "ad_entities" USING btree ("store_id","provider","external_id");--> statement-breakpoint
CREATE INDEX "idx_ad_entity_store_level" ON "ad_entities" USING btree ("store_id","provider","level");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ad_spend_store_provider_entity_date" ON "ad_spend" USING btree ("store_id","provider","entity_external_id","date");--> statement-breakpoint
CREATE INDEX "idx_ad_spend_store_date" ON "ad_spend" USING btree ("store_id","date");--> statement-breakpoint
CREATE INDEX "idx_ad_spend_store_level_date" ON "ad_spend" USING btree ("store_id","level","date");