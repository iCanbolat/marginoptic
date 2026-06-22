CREATE TYPE "public"."billing_plan" AS ENUM('basic', 'pro');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'paused', 'scheduled_cancel', 'canceled', 'expired');--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creem_event_id" varchar(255) NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"organization_id" uuid,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_events_creem_event_id_unique" UNIQUE("creem_event_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
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
	CONSTRAINT "subscriptions_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "subscriptions_creem_subscription_id_unique" UNIQUE("creem_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_billing_event_org" ON "billing_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_org" ON "subscriptions" USING btree ("organization_id");