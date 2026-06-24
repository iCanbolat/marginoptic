ALTER TYPE "public"."integration_provider" ADD VALUE 'ebay' BEFORE 'meta_ads';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'amazon' BEFORE 'meta_ads';--> statement-breakpoint
ALTER TYPE "public"."sales_channel" ADD VALUE 'ebay';--> statement-breakpoint
ALTER TYPE "public"."sales_channel" ADD VALUE 'amazon';