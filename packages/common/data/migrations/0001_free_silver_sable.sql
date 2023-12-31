ALTER TABLE "literature"."moves" ADD COLUMN "timestamp" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "literature"."players" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;