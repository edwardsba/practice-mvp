import { sql } from "drizzle-orm"
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { clients, practices, practitionerProfiles } from "./01-core"

/**
 * Living client background. One row per client, edited in place.
 * Demographics and clinician-rated risk sit here as JSON.
 * Relationships, partnerships, and history are normalized child tables
 * keyed by client_id — there is no interview document or version chain.
 */
export const clientBackgrounds = pgTable("client_backgrounds", {
  clientBackgroundId: uuid("client_background_id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .unique()
    .references(() => clients.clientId),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.practiceId),
  identityJson: jsonb("identity_json"),
  livingSituationJson: jsonb("living_situation_json"),
  educationJson: jsonb("education_json"),
  occupationJson: jsonb("occupation_json"),
  /** Currently taking and previously taken medication, plus who supervises it. */
  medicationJson: jsonb("medication_json"),
  /** One answer per stressor, plus the main reason for attending. */
  stressorsJson: jsonb("stressors_json"),
  riskJson: jsonb("risk_json"),
  /** Client's current relationship status. Not a field of any relative. */
  relationshipStatus: text("relationship_status"),
  relationshipStatusOther: text("relationship_status_other"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const clientRelationshipRecords = pgTable("client_relationship_records", {
  relationshipRecordId: uuid("relationship_record_id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.clientId),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.practiceId),
  relationshipToClient: text("relationship_to_client").notNull(),
  sex: text("sex"),
  givenName: text("given_name"),
  displayOrder: integer("display_order").notNull().default(0),
  /** Partial date: YYYY, YYYY-MM, or YYYY-MM-DD. */
  dateOfBirth: text("date_of_birth"),
  /** Legacy. New writes leave this null and store a year in date_of_birth instead. */
  approximateAge: integer("approximate_age"),
  approximateAgeRecordedOn: text("approximate_age_recorded_on"),
  deceased: boolean("deceased").notNull().default(false),
  healthStatus: text("health_status"),
  ageAtDeath: integer("age_at_death"),
  healthOrCauseOfDeath: text("health_or_cause_of_death"),
  lengthOfRelationship: text("length_of_relationship"),
  /** Prior partner: how the relationship ended. Current partners leave this null. */
  relationshipStatus: text("relationship_status"),
  timeSinceEnded: text("time_since_ended"),
  supportive: text("supportive"),
  conflict: text("conflict"),
  qualityOfRelationship: text("quality_of_relationship"),
  dependency: text("dependency"),
  livingSituation: text("living_situation"),
  caregiverRelationship: text("caregiver_relationship"),
  linkedPartnerRecordId: uuid("linked_partner_record_id"),
  partnershipRecordId: uuid("partnership_record_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/** A relationship between two people who are not the client (parents, or a parent and a step-parent). */
export const clientPartnershipRecords = pgTable("client_partnership_records", {
  partnershipRecordId: uuid("partnership_record_id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.clientId),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.practiceId),
  partnerAId: uuid("partner_a_id")
    .notNull()
    .references(() => clientRelationshipRecords.relationshipRecordId, {
      onDelete: "cascade",
    }),
  partnerBId: uuid("partner_b_id")
    .notNull()
    .references(() => clientRelationshipRecords.relationshipRecordId, {
      onDelete: "cascade",
    }),
  relationshipStatus: text("relationship_status"),
  started: text("started"),
  ended: text("ended"),
  qualityOfRelationship: text("quality_of_relationship"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const clientEventRecords = pgTable("client_event_records", {
  eventRecordId: uuid("event_record_id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.clientId),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.practiceId),
  eventType: text("event_type").notNull(),
  title: text("title"),
  description: text("description"),
  startPrecision: text("start_precision"),
  startValue: text("start_value"),
  endPrecision: text("end_precision"),
  endValue: text("end_value"),
  endOngoing: boolean("end_ongoing").notNull().default(false),
  resolvedOrOngoing: text("resolved_or_ongoing"),
  treated: boolean("treated"),
  treatmentType: text("treatment_type"),
  treatmentDetail: text("treatment_detail"),
  outcome: text("outcome"),
  attribution: text("attribution").notNull().default("self"),
  familyRelation: text("family_relation"),
  familySide: text("family_side"),
  relationshipRecordId: uuid("relationship_record_id").references(
    () => clientRelationshipRecords.relationshipRecordId,
    { onDelete: "set null" }
  ),
  selfHarmType: text("self_harm_type"),
  substanceStatus: text("substance_status"),
  abstinentSincePrecision: text("abstinent_since_precision"),
  abstinentSinceValue: text("abstinent_since_value"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/**
 * A clinician-led background interview. Field values live on Client Background.
 * This row stores who ran it, the history screening answers, and a completion snapshot.
 * self_report_id is the BACKGROUND_SR assessment result that was on screen when the
 * interview was completed, or null when the client had no self-report.
 */
export const clientBackgroundInterviews = pgTable(
  "client_background_interviews",
  {
    clientBackgroundInterviewId: uuid("client_background_interview_id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.clientId),
    practiceId: uuid("practice_id")
      .notNull()
      .references(() => practices.practiceId),
    practitionerProfileId: uuid("practitioner_profile_id")
      .notNull()
      .references(() => practitionerProfiles.practitionerProfileId),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    screeningJson: jsonb("screening_json").notNull().default({}),
    snapshotJson: jsonb("snapshot_json"),
    selfReportId: uuid("self_report_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    oneInProgress: uniqueIndex("client_background_interviews_one_in_progress")
      .on(table.clientId)
      .where(sql`${table.status} = 'in_progress'`),
  })
)
