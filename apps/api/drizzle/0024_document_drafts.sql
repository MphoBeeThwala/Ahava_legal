CREATE TABLE "document_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid DEFAULT nullif(current_setting('app.firm_id', true), '')::uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"template_id" text NOT NULL,
	"template_version" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"values_encrypted" text NOT NULL,
	"created_by" uuid,
	"submitted_at" timestamp with time zone,
	"finalised_by" uuid,
	"finalised_at" timestamp with time zone,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_finalised_by_users_id_fk" FOREIGN KEY ("finalised_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_drafts" ADD CONSTRAINT "document_drafts_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_drafts_case_idx" ON "document_drafts" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE POLICY "document_drafts_tenant_isolation" ON "document_drafts" AS PERMISSIVE FOR ALL TO public USING (firm_id = nullif(current_setting('app.firm_id', true), '')::uuid) WITH CHECK (firm_id = nullif(current_setting('app.firm_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "document_drafts_matter_access" ON "document_drafts" AS RESTRICTIVE FOR ALL TO "app_tenant" USING (exists (select 1 from cases c where c.id = document_drafts.case_id)) WITH CHECK (exists (select 1 from cases c where c.id = document_drafts.case_id));--> statement-breakpoint
ALTER TABLE "document_drafts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "document_drafts" TO app_tenant;