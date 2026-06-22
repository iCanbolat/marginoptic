CREATE TYPE "public"."custom_metric_format" AS ENUM('currency', 'number', 'percent');--> statement-breakpoint
CREATE TYPE "public"."widget_type" AS ENUM('kpi', 'timeseries', 'pnl', 'products', 'cost_breakdown', 'channel', 'custom_metric');--> statement-breakpoint
CREATE TABLE "custom_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
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
	"organization_id" uuid NOT NULL,
	"created_by" uuid,
	"name" varchar(120) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_metrics" ADD CONSTRAINT "custom_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_custom_metric_org_name" ON "custom_metrics" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "idx_custom_metric_org" ON "custom_metrics" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_widget_dashboard" ON "dashboard_widgets" USING btree ("dashboard_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_widget_dashboard_key" ON "dashboard_widgets" USING btree ("dashboard_id","widget_key");--> statement-breakpoint
CREATE INDEX "idx_dashboard_org" ON "dashboards" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_dashboard_default" ON "dashboards" USING btree ("organization_id") WHERE "dashboards"."is_default";