ALTER TABLE "case_tasks" ADD COLUMN "content_encrypted" text;--> statement-breakpoint
ALTER TABLE "case_timeline" ADD COLUMN "content_encrypted" text;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "title_encrypted" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "meta_encrypted" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "content_encrypted" text;--> statement-breakpoint
ALTER TABLE "report_snapshots" ADD COLUMN "title_encrypted" text;