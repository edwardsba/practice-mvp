CREATE TABLE IF NOT EXISTS "battery_instances" (
	"battery_instance_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"practitioner_profile_id" uuid NOT NULL,
	"battery_code" text DEFAULT 'PRE_SESSION' NOT NULL,
	"phq9_instance_id" uuid NOT NULL,
	"gad7_instance_id" uuid NOT NULL,
	"phq9_link_id" uuid NOT NULL,
	"gad7_link_id" uuid NOT NULL,
	"status" text DEFAULT 'assigned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battery_instances" ADD CONSTRAINT "battery_instances_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battery_instances" ADD CONSTRAINT "battery_instances_client_id_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("client_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battery_instances" ADD CONSTRAINT "battery_instances_practitioner_profile_id_practitioner_profiles_practitioner_profile_id_fk" FOREIGN KEY ("practitioner_profile_id") REFERENCES "public"."practitioner_profiles"("practitioner_profile_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battery_instances" ADD CONSTRAINT "battery_instances_phq9_instance_id_assessment_instances_assessment_instance_id_fk" FOREIGN KEY ("phq9_instance_id") REFERENCES "public"."assessment_instances"("assessment_instance_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battery_instances" ADD CONSTRAINT "battery_instances_gad7_instance_id_assessment_instances_assessment_instance_id_fk" FOREIGN KEY ("gad7_instance_id") REFERENCES "public"."assessment_instances"("assessment_instance_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battery_instances" ADD CONSTRAINT "battery_instances_phq9_link_id_assessment_access_links_assessment_access_link_id_fk" FOREIGN KEY ("phq9_link_id") REFERENCES "public"."assessment_access_links"("assessment_access_link_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battery_instances" ADD CONSTRAINT "battery_instances_gad7_link_id_assessment_access_links_assessment_access_link_id_fk" FOREIGN KEY ("gad7_link_id") REFERENCES "public"."assessment_access_links"("assessment_access_link_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "battery_instances" ENABLE ROW LEVEL SECURITY;
