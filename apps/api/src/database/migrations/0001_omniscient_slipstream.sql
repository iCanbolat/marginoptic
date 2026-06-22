CREATE TYPE "public"."connection_status" AS ENUM('pending', 'active', 'error', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('shopify', 'etsy', 'meta_ads', 'google_ads', 'tiktok_ads');--> statement-breakpoint
CREATE TYPE "public"."sales_channel" AS ENUM('shopify', 'etsy');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('idle', 'queued', 'running', 'done', 'error');--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid,
	"provider" "integration_provider" NOT NULL,
	"status" "connection_status" DEFAULT 'pending' NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"scopes" text,
	"external_account_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"channel" "sales_channel" NOT NULL,
	"name" varchar(200) NOT NULL,
	"external_shop_id" varchar(255) NOT NULL,
	"domain" varchar(255),
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"resource" varchar(64) NOT NULL,
	"cursor" text,
	"status" "sync_status" DEFAULT 'idle' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_state" ADD CONSTRAINT "sync_state_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_conn_org" ON "integration_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_conn_org_provider_account" ON "integration_connections" USING btree ("organization_id","provider","external_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_store_org_channel_external" ON "stores" USING btree ("organization_id","channel","external_shop_id");--> statement-breakpoint
CREATE INDEX "idx_store_org" ON "stores" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sync_conn_resource" ON "sync_state" USING btree ("connection_id","resource");