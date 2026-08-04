import { jsonb, pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { assessmentDefinitions } from './02-assessment-definitions'
import { clients, practices, practitionerProfiles } from './01-core'

export const assessmentInstances = pgTable('assessment_instances', {
  assessmentInstanceId: uuid('assessment_instance_id').primaryKey().defaultRandom(),
  assessmentDefinitionId: uuid('assessment_definition_id').notNull().references(() => assessmentDefinitions.assessmentDefinitionId),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  practitionerProfileId: uuid('practitioner_profile_id').notNull().references(() => practitionerProfiles.practitionerProfileId),
  appointmentId: uuid('appointment_id'),
  sessionNoteId: uuid('session_note_id'),
  status: text('status').notNull().default('assigned'),
  instanceElementsJson: jsonb('instance_elements_json'),
  // Pre-filled answers carried forward from an earlier instrument (currently just the
  // Specific Disorder Selector -> Panic/Agoraphobia/Social/Separation severity scales' item 1).
  // Keyed by elementKey (not assessmentElementId) so it's readable and stable across the write
  // (at trigger time, before this instance's elements exist to query) and the read (at load
  // time). Client can still edit the pre-filled answer normally — this is a default, not a
  // lock — so it's never written directly into assessment_responses; only load-questionnaire.ts
  // reads it, to seed the form's initial state.
  carriedResponsesJson: jsonb('carried_responses_json'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assessmentAccessLinks = pgTable('assessment_access_links', {
  assessmentAccessLinkId: uuid('assessment_access_link_id').primaryKey().defaultRandom(),
  assessmentInstanceId: uuid('assessment_instance_id').notNull().references(() => assessmentInstances.assessmentInstanceId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  accessStatus: text('access_status').notNull().default('active'),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  failedAttemptCount: integer('failed_attempt_count').notNull().default(0),
  nextAccessLinkId: uuid('next_access_link_id'),
  nextRawToken: text('next_raw_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assessmentResponses = pgTable('assessment_responses', {
  assessmentResponseId: uuid('assessment_response_id').primaryKey().defaultRandom(),
  assessmentInstanceId: uuid('assessment_instance_id').notNull().references(() => assessmentInstances.assessmentInstanceId),
  assessmentElementId: uuid('assessment_element_id').notNull(),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  responseValue: text('response_value').notNull(),
  scoreValue: integer('score_value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assessmentResults = pgTable('assessment_results', {
  assessmentResultId: uuid('assessment_result_id').primaryKey().defaultRandom(),
  assessmentInstanceId: uuid('assessment_instance_id').notNull().references(() => assessmentInstances.assessmentInstanceId),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  score: integer('score'), // nullable — structured-only instruments (e.g. Level 1 XC's 13 domain scores) use structuredScoreJson instead and leave this null
  severity: text('severity'),
  acuteRiskRating: text('acute_risk_rating'),
  structuredScoreJson: jsonb('structured_score_json'), // domain scores / subscales / facets, instrument-specific shape — see lib/assessments/scoring/*.ts
  assessmentDate: timestamp('assessment_date', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull().default('scored'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
