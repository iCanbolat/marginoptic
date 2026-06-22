CREATE TABLE "daily_store_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"date" date NOT NULL,
	"currency" varchar(3) NOT NULL,
	"revenue" numeric(20, 4) DEFAULT '0' NOT NULL,
	"discounts" numeric(20, 4) DEFAULT '0' NOT NULL,
	"refunds" numeric(20, 4) DEFAULT '0' NOT NULL,
	"cogs" numeric(20, 4) DEFAULT '0' NOT NULL,
	"shipping_cost" numeric(20, 4) DEFAULT '0' NOT NULL,
	"payment_fees" numeric(20, 4) DEFAULT '0' NOT NULL,
	"taxes" numeric(20, 4) DEFAULT '0' NOT NULL,
	"ad_spend" numeric(20, 4) DEFAULT '0' NOT NULL,
	"custom_expenses" numeric(20, 4) DEFAULT '0' NOT NULL,
	"net_profit" numeric(20, 4) DEFAULT '0' NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"base" varchar(3) NOT NULL,
	"quote" varchar(3) NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_profit_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"date" date NOT NULL,
	"product_external_id" varchar(255) NOT NULL,
	"title" varchar(500),
	"currency" varchar(3) NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(20, 4) DEFAULT '0' NOT NULL,
	"cogs" numeric(20, 4) DEFAULT '0' NOT NULL,
	"attributed_ad_spend" numeric(20, 4) DEFAULT '0' NOT NULL,
	"net_profit" numeric(20, 4) DEFAULT '0' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_store_metrics" ADD CONSTRAINT "daily_store_metrics_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_profit_daily" ADD CONSTRAINT "product_profit_daily_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_daily_metric_store_date" ON "daily_store_metrics" USING btree ("store_id","date");--> statement-breakpoint
CREATE INDEX "idx_daily_metric_store_date" ON "daily_store_metrics" USING btree ("store_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fx_date_base_quote" ON "fx_rates" USING btree ("date","base","quote");--> statement-breakpoint
CREATE INDEX "idx_fx_base_quote_date" ON "fx_rates" USING btree ("base","quote","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_profit_store_product_date" ON "product_profit_daily" USING btree ("store_id","product_external_id","date");--> statement-breakpoint
CREATE INDEX "idx_product_profit_store_date" ON "product_profit_daily" USING btree ("store_id","date");