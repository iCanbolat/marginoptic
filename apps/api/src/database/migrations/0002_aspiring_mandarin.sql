CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
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
	"store_id" uuid NOT NULL,
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
	"store_id" uuid NOT NULL,
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
	"store_id" uuid NOT NULL,
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
	"store_id" uuid NOT NULL,
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
	"store_id" uuid NOT NULL,
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
	"store_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"amount" numeric(20, 4),
	"shipping_refunded" numeric(20, 4),
	"tax_refunded" numeric(20, 4),
	"note" text,
	"processed_at" timestamp with time zone,
	"shopify_created_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sync_state" ADD COLUMN "stats" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_transactions" ADD CONSTRAINT "order_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_transactions" ADD CONSTRAINT "order_transactions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_customer_store_external" ON "customers" USING btree ("store_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_customer_store" ON "customers" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_item_store_external" ON "order_line_items" USING btree ("store_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_line_item_order" ON "order_line_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_line_item_variant" ON "order_line_items" USING btree ("store_id","variant_external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_txn_store_external" ON "order_transactions" USING btree ("store_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_txn_order" ON "order_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_order_store_external" ON "orders" USING btree ("store_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_order_store_processed" ON "orders" USING btree ("store_id","processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_variant_store_external" ON "product_variants" USING btree ("store_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_variant_store" ON "product_variants" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_variant_sku" ON "product_variants" USING btree ("store_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_store_external" ON "products" USING btree ("store_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_product_store" ON "products" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_refund_store_external" ON "refunds" USING btree ("store_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_refund_order" ON "refunds" USING btree ("order_id");