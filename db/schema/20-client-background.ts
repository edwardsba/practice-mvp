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
 * Relationships and history are normalized child tables
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
  /** One answer per stressor, plus the main reason for attending. */
  stressorsJson: jsonb("stressors_json"),
  /** Referral type, referrer, and their concerns. */
  reasonForAttendingJson: jsonb("reason_for_attending_json"),
  riskJson: jsonb("risk_json"),
  /** Client's current relationship status. Not a field of any relative. */
  relationshipStatus: text("relationship_status"),
  relationshipStatusOther: text("relationship_status_other"),
  /** Yes / None / Not asked for relationship blocks. Adding a block sets Yes; removing the last sets Not asked. */
  previousRelationships: text("previous_relationships"),
  otherChildren: text("other_children"),
  motherOtherRelationships: text("mother_other_relationships"),
  fatherOtherRelationships: text("father_other_relationships"),
  caregiverArrangements: text("caregiver_arrangements"),
  /** Heterosexual, gay, lesbian, bisexual, pansexual, asexual, queer, another, or prefer_not_to_say. */
  sexualOrientation: text("sexual_orientation"),
  /** Free text when sexual_orientation is another. */
  sexualOrientationOther: text("sexual_orientation_other"),
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
  /** Partial date: YYYY, YYYY-MM, or YYYY-MM-DD. A year is enough. */
  dateOfDeath: text("date_of_death"),
  healthOrCauseOfDeath: text("health_or_cause_of_death"),
  /** Child records: biological, adopted, step_child, foster, or other. */
  childType: text("child_type"),
  /** Description when child_type is other. */
  childTypeDetail: text("child_type_detail"),
  supportive: text("supportive"),
  conflict: text("conflict"),
  qualityOfRelationship: text("quality_of_relationship"),
  dependency: text("dependency"),
  livingSituation: text("living_situation"),
  caregiverRelationship: text("caregiver_relationship"),
  /** Free text when caregiver_relationship is other. */
  caregiverRelationshipDetail: text("caregiver_relationship_detail"),
  /** Parent is not known. Other parent fields are hidden while this is set. */
  notKnown: boolean("not_known").notNull().default(false),
  /** The relationship block this person belongs to. Null when they could not be placed. */
  relationshipBlockId: uuid("relationship_block_id"),
  /** partner, child, parent, sibling, or caregiver. */
  blockRole: text("block_role"),
  /** Role-specific type: child type, sibling type, mother/father, or caregiver relationship. */
  blockRoleType: text("block_role_type"),
  /** unlinked_child or unplaced. Cleared when the person is moved. */
  placementReview: text("placement_review"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/** One relationship: its status and dates, and the people who belong to it. */
export const clientRelationshipBlocks = pgTable("client_relationship_blocks", {
  relationshipBlockId: uuid("relationship_block_id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.clientId),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.practiceId),
  kind: text("kind").notNull(),
  parentRecordId: uuid("parent_record_id"),
  parentSide: text("parent_side"),
  status: text("status"),
  statusDetail: text("status_detail"),
  arrangementType: text("arrangement_type"),
  arrangementDetail: text("arrangement_detail"),
  startedOn: text("started_on"),
  endedOn: text("ended_on"),
  noChildren: boolean("no_children").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
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
  /** self or significant_other. Significant-other entries use relationship_record_id or about_other. */
  about: text("about"),
  /** Who, when the significant other is not a recorded person. */
  aboutOther: text("about_other"),
  relationshipRecordId: uuid("relationship_record_id").references(
    () => clientRelationshipRecords.relationshipRecordId,
    { onDelete: "set null" }
  ),
  /** Treatment entries: the condition this treatment is for. */
  conditionEventId: uuid("condition_event_id"),
  /** Episodes of one condition share this id. Null on events that are not a condition. */
  conditionGroupId: uuid("condition_group_id"),
  /** Admission entries: psychiatric_inpatient, residential_rehab, medical, or emergency_department. */
  admissionType: text("admission_type"),
  facility: text("facility"),
  /** Admission length when a discharge date was not recorded. */
  admissionLength: text("admission_length"),
  prescriberProfessionalId: uuid("prescriber_professional_id"),
  /** Free-text supervisor carried over from the old medication record. */
  prescriberName: text("prescriber_name"),
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
