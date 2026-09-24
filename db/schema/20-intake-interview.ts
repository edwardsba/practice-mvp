import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { clients, practices, practitionerProfiles } from "./01-core"

/**
 * Clinician-completed diagnostic intake interview. Typically one current
 * record per client; draft → finalise with versioning so a later intake
 * episode does not overwrite a finalised history.
 *
 * Flat/compound sections (identity, living, education, occupation,
 * financial, social support, roster inputs) are JSON blobs — same
 * convention as treatment-plan compound fields. Relationship and event
 * records are normalized because Family History events foreign-key to a
 * captured family member.
 */
export const intakeInterviews = pgTable("intake_interviews", {
  intakeInterviewId: uuid("intake_interview_id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.clientId),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.practiceId),
  practitionerProfileId: uuid("practitioner_profile_id")
    .notNull()
    .references(() => practitionerProfiles.practitionerProfileId),
  interviewDate: date("interview_date"),
  status: text("status").notNull().default("draft"),
  versionNumber: integer("version_number").notNull().default(1),
  isCurrentVersion: boolean("is_current_version").notNull().default(true),
  previousVersionId: uuid("previous_version_id"),
  isActive: boolean("is_active").notNull().default(true),
  identityJson: jsonb("identity_json"),
  familyOfOriginRosterJson: jsonb("family_of_origin_roster_json"),
  partnersChildrenRosterJson: jsonb("partners_children_roster_json"),
  familyOfOriginSummary: text("family_of_origin_summary"),
  partnersChildrenSummary: text("partners_children_summary"),
  familyHistoryJson: jsonb("family_history_json"),
  livingSituationJson: jsonb("living_situation_json"),
  educationJson: jsonb("education_json"),
  occupationJson: jsonb("occupation_json"),
  financialSituationJson: jsonb("financial_situation_json"),
  socialSupportJson: jsonb("social_support_json"),
  finalisedAt: timestamp("finalised_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const intakeRelationshipRecords = pgTable("intake_relationship_records", {
  relationshipRecordId: uuid("relationship_record_id").primaryKey().defaultRandom(),
  intakeInterviewId: uuid("intake_interview_id")
    .notNull()
    .references(() => intakeInterviews.intakeInterviewId),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.clientId),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.practiceId),
  section: text("section").notNull(),
  rosterKey: text("roster_key").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  relationshipToClient: text("relationship_to_client").notNull(),
  givenName: text("given_name"),
  linkedPartnerRecordId: uuid("linked_partner_record_id"),
  age: integer("age"),
  deceased: boolean("deceased").notNull().default(false),
  ageAtDeath: integer("age_at_death"),
  healthOrCauseOfDeath: text("health_or_cause_of_death"),
  lengthOfRelationship: text("length_of_relationship"),
  relationshipStatus: text("relationship_status"),
  timeSinceEnded: text("time_since_ended"),
  qualityOfRelationship: text("quality_of_relationship"),
  dependency: text("dependency"),
  livingSituation: text("living_situation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const intakeEventRecords = pgTable("intake_event_records", {
  eventRecordId: uuid("event_record_id").primaryKey().defaultRandom(),
  intakeInterviewId: uuid("intake_interview_id")
    .notNull()
    .references(() => intakeInterviews.intakeInterviewId),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.clientId),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.practiceId),
  eventCategory: text("event_category").notNull(),
  subDomain: text("sub_domain").notNull(),
  personKind: text("person_kind").notNull(),
  relationshipRecordId: uuid("relationship_record_id"),
  endorsed: boolean("endorsed").notNull().default(false),
  reasonDescription: text("reason_description"),
  ageDateStart: text("age_date_start"),
  ageDateEnd: text("age_date_end"),
  resolvedOrOngoing: text("resolved_or_ongoing"),
  severityImpact: text("severity_impact"),
  treated: boolean("treated"),
  treatmentType: text("treatment_type"),
  treatmentDetail: text("treatment_detail"),
  outcome: text("outcome"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
