CREATE TABLE "clients" (
	"client_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth" text,
	"email" "citext",
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practices" (
	"practice_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_name" text NOT NULL,
	"timezone" text DEFAULT 'Australia/Sydney' NOT NULL,
	"address" text,
	"phone" text,
	"email" "citext",
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practitioner_profiles" (
	"practitioner_profile_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"title" text,
	"full_name" text NOT NULL,
	"registration_number" text,
	"registration_body" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'practitioner' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "assessment_definitions" (
	"assessment_definition_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_code" text NOT NULL,
	"assessment_name" text NOT NULL,
	"assessment_type" text DEFAULT 'psychometric_assessment' NOT NULL,
	"description" text,
	"scoring_enabled" boolean DEFAULT true NOT NULL,
	"client_completable" boolean DEFAULT true NOT NULL,
	"practitioner_completable" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_definitions_assessment_code_unique" UNIQUE("assessment_code")
);
--> statement-breakpoint
CREATE TABLE "assessment_elements" (
	"assessment_element_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_definition_id" uuid NOT NULL,
	"element_key" text NOT NULL,
	"question_text" text NOT NULL,
	"element_type" text DEFAULT 'radio' NOT NULL,
	"data_type" text DEFAULT 'integer' NOT NULL,
	"display_order" integer NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_elements_element_key_unique" UNIQUE("element_key")
);
--> statement-breakpoint
CREATE TABLE "assessment_options" (
	"assessment_option_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_element_id" uuid NOT NULL,
	"assessment_definition_id" uuid NOT NULL,
	"option_label" text NOT NULL,
	"option_value" text NOT NULL,
	"score_value" integer NOT NULL,
	"display_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_access_links" (
	"assessment_access_link_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_instance_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"access_status" text DEFAULT 'active' NOT NULL,
	"opened_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"failed_attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_access_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "assessment_instances" (
	"assessment_instance_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_definition_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"practitioner_profile_id" uuid NOT NULL,
	"status" text DEFAULT 'assigned' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_responses" (
	"assessment_response_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_instance_id" uuid NOT NULL,
	"assessment_element_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"response_value" text NOT NULL,
	"score_value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_results" (
	"assessment_result_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_instance_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"severity" text NOT NULL,
	"assessment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'scored' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"audit_event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid,
	"user_id" uuid,
	"client_id" uuid,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"actor_metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simple_reports" (
	"simple_report_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"practice_id" uuid NOT NULL,
	"practitioner_profile_id" uuid NOT NULL,
	"report_type" text DEFAULT 'phq9_progress' NOT NULL,
	"date_range_start" date NOT NULL,
	"date_range_end" date NOT NULL,
	"values_snapshot_json" jsonb,
	"clinical_summary_text" text,
	"recommendations_text" text,
	"report_status" text DEFAULT 'draft' NOT NULL,
	"finalised_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_profiles" ADD CONSTRAINT "practitioner_profiles_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practitioner_profiles" ADD CONSTRAINT "practitioner_profiles_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_elements" ADD CONSTRAINT "assessment_elements_assessment_definition_id_assessment_definitions_assessment_definition_id_fk" FOREIGN KEY ("assessment_definition_id") REFERENCES "public"."assessment_definitions"("assessment_definition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_options" ADD CONSTRAINT "assessment_options_assessment_element_id_assessment_elements_assessment_element_id_fk" FOREIGN KEY ("assessment_element_id") REFERENCES "public"."assessment_elements"("assessment_element_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_options" ADD CONSTRAINT "assessment_options_assessment_definition_id_assessment_definitions_assessment_definition_id_fk" FOREIGN KEY ("assessment_definition_id") REFERENCES "public"."assessment_definitions"("assessment_definition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_access_links" ADD CONSTRAINT "assessment_access_links_assessment_instance_id_assessment_instances_assessment_instance_id_fk" FOREIGN KEY ("assessment_instance_id") REFERENCES "public"."assessment_instances"("assessment_instance_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_access_links" ADD CONSTRAINT "assessment_access_links_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_access_links" ADD CONSTRAINT "assessment_access_links_client_id_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_instances" ADD CONSTRAINT "assessment_instances_assessment_definition_id_assessment_definitions_assessment_definition_id_fk" FOREIGN KEY ("assessment_definition_id") REFERENCES "public"."assessment_definitions"("assessment_definition_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_instances" ADD CONSTRAINT "assessment_instances_client_id_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_instances" ADD CONSTRAINT "assessment_instances_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_instances" ADD CONSTRAINT "assessment_instances_practitioner_profile_id_practitioner_profiles_practitioner_profile_id_fk" FOREIGN KEY ("practitioner_profile_id") REFERENCES "public"."practitioner_profiles"("practitioner_profile_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_assessment_instance_id_assessment_instances_assessment_instance_id_fk" FOREIGN KEY ("assessment_instance_id") REFERENCES "public"."assessment_instances"("assessment_instance_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_client_id_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_assessment_instance_id_assessment_instances_assessment_instance_id_fk" FOREIGN KEY ("assessment_instance_id") REFERENCES "public"."assessment_instances"("assessment_instance_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_client_id_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_client_id_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simple_reports" ADD CONSTRAINT "simple_reports_client_id_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simple_reports" ADD CONSTRAINT "simple_reports_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simple_reports" ADD CONSTRAINT "simple_reports_practitioner_profile_id_practitioner_profiles_practitioner_profile_id_fk" FOREIGN KEY ("practitioner_profile_id") REFERENCES "public"."practitioner_profiles"("practitioner_profile_id") ON DELETE no action ON UPDATE no action;