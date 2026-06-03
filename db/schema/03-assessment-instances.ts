import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { assessmentDefinitions } from './02-assessment-definitions'
import { clients, practices, practitionerProfiles } from './01-core'

export const assessmentInstances = pgTable('assessment_instances', {
  assessmentInstanceId: uuid('assessment_instance_id').primaryKey().defaultRandom(),
  assessmentDefinitionId: uuid('assessment_definition_id').notNull().references(() => assessmentDefinitions.assessmentDefinitionId),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  practitionerProfileId: uuid('practitioner_profile_id').notNull().references(() => practitionerProfiles.practitionerProfileId),
  status: text('status').notNull().default('assigned'),
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
  score: integer('score').notNull(),
  severity: text('severity').notNull(),
  assessmentDate: timestamp('assessment_date', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull().default('scored'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
