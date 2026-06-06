CREATE TABLE "professions" (
	"profession_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"profession_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "professional_organisations" (
	"organisation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"organisation_name" text NOT NULL,
	"street_address" text,
	"postal_address" text,
	"phone" text,
	"fax" text,
	"email" text,
	"claims_email" text,
	"secure_messaging" text,
	"website" text,
	"organisation_type" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "professionals" (
	"professional_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"title" text,
	"profession_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "professional_organisation_links" (
	"link_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"medicare_provider_number" text,
	"direct_phone" text,
	"direct_email" text,
	"direct_secure_messaging" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "professions" ADD CONSTRAINT "professions_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "professional_organisations" ADD CONSTRAINT "professional_organisations_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "professionals" ADD CONSTRAINT "professionals_practice_id_practices_practice_id_fk" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("practice_id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "professionals" ADD CONSTRAINT "professionals_profession_id_professions_profession_id_fk" FOREIGN KEY ("profession_id") REFERENCES "public"."professions"("profession_id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "professional_organisation_links" ADD CONSTRAINT "professional_organisation_links_professional_id_professionals_professional_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("professional_id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "professional_organisation_links" ADD CONSTRAINT "professional_organisation_links_organisation_id_professional_organisations_organisation_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."professional_organisations"("organisation_id") ON DELETE no action ON UPDATE no action;
