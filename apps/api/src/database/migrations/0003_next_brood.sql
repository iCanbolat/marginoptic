CREATE TYPE "public"."cogs_scope" AS ENUM('sku', 'variant', 'product', 'global');--> statement-breakpoint
CREATE TYPE "public"."expense_allocation" AS ENUM('store', 'spread');--> statement-breakpoint
CREATE TYPE "public"."expense_recurrence" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."expense_type" AS ENUM('one_time', 'recurring');--> statement-breakpoint
CREATE TABLE "cogs_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
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
	"organization_id" uuid NOT NULL,
	"store_id" uuid,
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
	"store_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_fee_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
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
	"store_id" uuid NOT NULL,
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
	"store_id" uuid NOT NULL,
	"sales_tax_borne" boolean DEFAULT false NOT NULL,
	"income_tax_rate" numeric(7, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cogs_rules" ADD CONSTRAINT "cogs_rules_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_expenses" ADD CONSTRAINT "custom_expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_expenses" ADD CONSTRAINT "custom_expenses_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_custom_expense_id_custom_expenses_id_fk" FOREIGN KEY ("custom_expense_id") REFERENCES "public"."custom_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_allocations" ADD CONSTRAINT "expense_allocations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_fee_rules" ADD CONSTRAINT "payment_fee_rules_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_cost_rules" ADD CONSTRAINT "shipping_cost_rules_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_config" ADD CONSTRAINT "tax_config_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cogs_lookup" ON "cogs_rules" USING btree ("store_id","scope","match_value");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cogs_default_rule" ON "cogs_rules" USING btree ("store_id","scope","match_value") WHERE "cogs_rules"."effective_from" is null and "cogs_rules"."country" is null and "cogs_rules"."min_qty" = 1;--> statement-breakpoint
CREATE INDEX "idx_custom_expense_org" ON "custom_expenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_custom_expense_store" ON "custom_expenses" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expense_alloc" ON "expense_allocations" USING btree ("custom_expense_id","store_id","date");--> statement-breakpoint
CREATE INDEX "idx_expense_alloc_store_date" ON "expense_allocations" USING btree ("store_id","date");--> statement-breakpoint
CREATE INDEX "idx_payment_fee_store" ON "payment_fee_rules" USING btree ("store_id","gateway");--> statement-breakpoint
CREATE INDEX "idx_shipping_store" ON "shipping_cost_rules" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tax_config_store" ON "tax_config" USING btree ("store_id");