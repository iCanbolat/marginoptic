CREATE TYPE "public"."connection_status" AS ENUM('pending', 'active', 'error', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('shopify', 'ebay', 'amazon', 'meta_ads', 'google_ads', 'tiktok_ads', 'amazon_ads', 'ebay_ads');--> statement-breakpoint
CREATE TYPE "public"."sales_channel" AS ENUM('shopify', 'ebay', 'amazon');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('idle', 'queued', 'running', 'done', 'error');--> statement-breakpoint
CREATE TYPE "public"."cogs_scope" AS ENUM('sku', 'variant', 'product', 'global');--> statement-breakpoint
CREATE TYPE "public"."expense_allocation" AS ENUM('store', 'spread');--> statement-breakpoint
CREATE TYPE "public"."expense_recurrence" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."expense_type" AS ENUM('one_time', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."ad_level" AS ENUM('account', 'campaign', 'adset', 'ad');--> statement-breakpoint
CREATE TYPE "public"."ad_link_match_type" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."custom_metric_format" AS ENUM('currency', 'number', 'percent');--> statement-breakpoint
CREATE TYPE "public"."widget_type" AS ENUM('kpi', 'timeseries', 'pnl', 'products', 'cost_breakdown', 'channel', 'custom_metric');--> statement-breakpoint
CREATE TYPE "public"."billing_plan" AS ENUM('basic', 'pro');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'paused', 'scheduled_cancel', 'canceled', 'expired');--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"family_id" uuid NOT NULL,
	"active_store_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(200) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"channel" "sales_channel" NOT NULL,
	"name" varchar(200) NOT NULL,
	"external_shop_id" varchar(255) NOT NULL,
	"domain" varchar(255),
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"tracking_key" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"channel_id" uuid,
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
CREATE TABLE "sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"resource" varchar(64) NOT NULL,
	"cursor" text,
	"status" "sync_status" DEFAULT 'idle' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(320),
	"first_name" varchar(200),
	"last_name" varchar(200),
	"orders_count" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(20, 4),
	"currency" varchar(3),
	"shopify_created_at" timestamp with time zone,
	"shopify_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"product_external_id" varchar(255),
	"variant_external_id" varchar(255),
	"sku" varchar(255),
	"title" varchar(500),
	"quantity" integer DEFAULT 0 NOT NULL,
	"price" numeric(20, 4),
	"discount_amount" numeric(20, 4),
	"total_amount" numeric(20, 4)
);
--> statement-breakpoint
CREATE TABLE "order_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"kind" varchar(32),
	"status" varchar(32),
	"gateway" varchar(128),
	"amount" numeric(20, 4),
	"fee" numeric(20, 4),
	"currency" varchar(3),
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"name" varchar(64),
	"email" varchar(320),
	"customer_external_id" varchar(255),
	"financial_status" varchar(48),
	"fulfillment_status" varchar(48),
	"currency" varchar(3),
	"presentment_currency" varchar(3),
	"subtotal_price" numeric(20, 4),
	"total_price" numeric(20, 4),
	"total_discounts" numeric(20, 4),
	"total_tax" numeric(20, 4),
	"total_shipping" numeric(20, 4),
	"total_refunded" numeric(20, 4),
	"test" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"shopify_created_at" timestamp with time zone,
	"shopify_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"product_id" uuid,
	"external_id" varchar(255) NOT NULL,
	"external_product_id" varchar(255),
	"sku" varchar(255),
	"title" varchar(500),
	"price" numeric(20, 4),
	"inventory_quantity" integer,
	"shopify_created_at" timestamp with time zone,
	"shopify_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"handle" varchar(500),
	"status" varchar(32),
	"vendor" varchar(255),
	"product_type" varchar(255),
	"shopify_created_at" timestamp with time zone,
	"shopify_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"amount" numeric(20, 4),
	"shipping_refunded" numeric(20, 4),
	"tax_refunded" numeric(20, 4),
	"note" text,
	"processed_at" timestamp with time zone,
	"shopify_created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cogs_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"scope" "cogs_scope" NOT NULL,
	"match_value" varchar(255),
	"country" varchar(2),
	"min_qty" integer DEFAULT 1 NOT NULL,
	"cost_amount" numeric(20, 4) NOT NULL,
	"handling_fee" numeric(20, 4),
	"currency" varchar(3),
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"channel_id" uuid,
	"name" varchar(200) NOT NULL,
	"category" varchar(64),
	"type" "expense_type" NOT NULL,
	"recurrence" "expense_recurrence",
	"allocation" "expense_allocation" DEFAULT 'store' NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_expense_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"gateway" varchar(128),
	"percentage" numeric(7, 4) DEFAULT '0' NOT NULL,
	"fixed_fee" numeric(20, 4) DEFAULT '0' NOT NULL,
	"currency" varchar(3),
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_cost_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"country" varchar(2),
	"min_qty" integer,
	"max_qty" integer,
	"min_weight_grams" integer,
	"max_weight_grams" integer,
	"base_cost" numeric(20, 4) DEFAULT '0' NOT NULL,
	"per_item_cost" numeric(20, 4),
	"currency" varchar(3),
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"source" varchar(32) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"sales_tax_borne" boolean DEFAULT false NOT NULL,
	"income_tax_rate" numeric(7, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_store_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
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
	"channel_id" uuid NOT NULL,
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
CREATE TABLE "ad_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
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
	"channel_id" uuid NOT NULL,
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
CREATE TABLE "product_ad_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
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
	"channel_id" uuid NOT NULL,
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
	"channel_id" uuid NOT NULL,
	"date" date NOT NULL,
	"product_external_id" varchar(255) NOT NULL,
	"channel" varchar(32) NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"product_views" integer DEFAULT 0 NOT NULL,
	"purchases" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"formula" text NOT NULL,
	"format" "custom_metric_format" DEFAULT 'number' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_id" uuid NOT NULL,
	"widget_key" varchar(64) NOT NULL,
	"type" "widget_type" NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"w" integer DEFAULT 4 NOT NULL,
	"h" integer DEFAULT 4 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"created_by" uuid,
	"name" varchar(120) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"scopes" text[] NOT NULL,
	"created_by" uuid,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creem_event_id" varchar(255) NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"user_id" uuid,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_events_creem_event_id_unique" UNIQUE("creem_event_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "billing_plan" NOT NULL,
	"status" "subscription_status" NOT NULL,
	"creem_customer_id" varchar(255),
	"creem_subscription_id" varchar(255),
	"creem_product_id" varchar(255),
	"trial_ends_at" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "subscriptions_creem_subscription_id_unique" UNIQUE("creem_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_active_store_id_stores_id_fk" FOREIGN KEY ("active_store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_state" ADD CONSTRAINT "sync_state_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_transactions" ADD CONSTRAINT "order_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_transactions" ADD CONSTRAINT "order_transactions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cogs_rules" ADD CONSTRAINT "cogs_rules_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_expenses" ADD CONSTRAINT "custom_expenses_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_expenses" ADD CONSTRAINT "custom_expenses_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_custom_expense_id_custom_expenses_id_fk" FOREIGN KEY ("custom_expense_id") REFERENCES "public"."custom_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_fee_rules" ADD CONSTRAINT "payment_fee_rules_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_cost_rules" ADD CONSTRAINT "shipping_cost_rules_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_config" ADD CONSTRAINT "tax_config_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_store_metrics" ADD CONSTRAINT "daily_store_metrics_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_profit_daily" ADD CONSTRAINT "product_profit_daily_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_entities" ADD CONSTRAINT "ad_entities_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_entities" ADD CONSTRAINT "ad_entities_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_connection_id_integration_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ad_links" ADD CONSTRAINT "product_ad_links_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_ad_spend_daily" ADD CONSTRAINT "product_ad_spend_daily_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_traffic_daily" ADD CONSTRAINT "product_traffic_daily_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_metrics" ADD CONSTRAINT "custom_metrics_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rt_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rt_family" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_org_owner" ON "stores" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_store_org_channel" ON "channels" USING btree ("store_id","channel");--> statement-breakpoint
CREATE INDEX "idx_store_org" ON "channels" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_conn_org" ON "integration_connections" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_conn_org_provider_account" ON "integration_connections" USING btree ("store_id","provider","external_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sync_conn_resource" ON "sync_state" USING btree ("connection_id","resource");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_customer_store_external" ON "customers" USING btree ("channel_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_customer_store" ON "customers" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_item_store_external" ON "order_line_items" USING btree ("channel_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_line_item_order" ON "order_line_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_line_item_variant" ON "order_line_items" USING btree ("channel_id","variant_external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_txn_store_external" ON "order_transactions" USING btree ("channel_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_txn_order" ON "order_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_order_store_external" ON "orders" USING btree ("channel_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_order_store_processed" ON "orders" USING btree ("channel_id","processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_variant_store_external" ON "product_variants" USING btree ("channel_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_variant_store" ON "product_variants" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_variant_sku" ON "product_variants" USING btree ("channel_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_store_external" ON "products" USING btree ("channel_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_product_store" ON "products" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refund_store_external" ON "refunds" USING btree ("channel_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_refund_order" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_cogs_lookup" ON "cogs_rules" USING btree ("channel_id","scope","match_value");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cogs_default_rule" ON "cogs_rules" USING btree ("channel_id","scope","match_value") WHERE "cogs_rules"."effective_from" is null and "cogs_rules"."country" is null and "cogs_rules"."min_qty" = 1;--> statement-breakpoint
CREATE INDEX "idx_custom_expense_org" ON "custom_expenses" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_custom_expense_store" ON "custom_expenses" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_alloc" ON "expense_allocations" USING btree ("custom_expense_id","channel_id","date");--> statement-breakpoint
CREATE INDEX "idx_expense_alloc_store_date" ON "expense_allocations" USING btree ("channel_id","date");--> statement-breakpoint
CREATE INDEX "idx_payment_fee_store" ON "payment_fee_rules" USING btree ("channel_id","gateway");--> statement-breakpoint
CREATE INDEX "idx_shipping_store" ON "shipping_cost_rules" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_config_store" ON "tax_config" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_daily_metric_store_date" ON "daily_store_metrics" USING btree ("channel_id","date");--> statement-breakpoint
CREATE INDEX "idx_daily_metric_store_date" ON "daily_store_metrics" USING btree ("channel_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fx_date_base_quote" ON "fx_rates" USING btree ("date","base","quote");--> statement-breakpoint
CREATE INDEX "idx_fx_base_quote_date" ON "fx_rates" USING btree ("base","quote","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_profit_store_product_date" ON "product_profit_daily" USING btree ("channel_id","product_external_id","date");--> statement-breakpoint
CREATE INDEX "idx_product_profit_store_date" ON "product_profit_daily" USING btree ("channel_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ad_entity_store_provider_external" ON "ad_entities" USING btree ("channel_id","provider","external_id");--> statement-breakpoint
CREATE INDEX "idx_ad_entity_store_level" ON "ad_entities" USING btree ("channel_id","provider","level");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ad_spend_store_provider_entity_date" ON "ad_spend" USING btree ("channel_id","provider","entity_external_id","date");--> statement-breakpoint
CREATE INDEX "idx_ad_spend_store_date" ON "ad_spend" USING btree ("channel_id","date");--> statement-breakpoint
CREATE INDEX "idx_ad_spend_store_level_date" ON "ad_spend" USING btree ("channel_id","level","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_ad_link" ON "product_ad_links" USING btree ("channel_id","product_external_id","provider","ad_entity_external_id");--> statement-breakpoint
CREATE INDEX "idx_product_ad_link_entity" ON "product_ad_links" USING btree ("channel_id","provider","ad_entity_external_id");--> statement-breakpoint
CREATE INDEX "idx_product_ad_link_product" ON "product_ad_links" USING btree ("channel_id","product_external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_ad_spend" ON "product_ad_spend_daily" USING btree ("channel_id","provider","product_external_id","date");--> statement-breakpoint
CREATE INDEX "idx_product_ad_spend_store_date" ON "product_ad_spend_daily" USING btree ("channel_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_traffic" ON "product_traffic_daily" USING btree ("channel_id","channel","product_external_id","date");--> statement-breakpoint
CREATE INDEX "idx_product_traffic_store_date" ON "product_traffic_daily" USING btree ("channel_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_custom_metric_org_name" ON "custom_metrics" USING btree ("store_id","name");--> statement-breakpoint
CREATE INDEX "idx_custom_metric_org" ON "custom_metrics" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_widget_dashboard" ON "dashboard_widgets" USING btree ("dashboard_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_widget_dashboard_key" ON "dashboard_widgets" USING btree ("dashboard_id","widget_key");--> statement-breakpoint
CREATE INDEX "idx_dashboard_org" ON "dashboards" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_dashboard_default" ON "dashboards" USING btree ("store_id") WHERE "dashboards"."is_default";--> statement-breakpoint
CREATE INDEX "idx_api_key_org" ON "api_keys" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_billing_event_user" ON "billing_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_user" ON "subscriptions" USING btree ("user_id");