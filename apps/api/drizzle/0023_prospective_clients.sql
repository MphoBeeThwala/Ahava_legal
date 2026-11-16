ALTER TABLE "parties" ADD COLUMN "prospective_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "party_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE set null ON UPDATE no action;