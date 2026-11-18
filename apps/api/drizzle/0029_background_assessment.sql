ALTER TABLE "submissions" ADD COLUMN "assessment_state" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "assessment_error" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "assessment_started_at" timestamp with time zone;