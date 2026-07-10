import { pgTable, uuid, text, timestamp, jsonb, date, integer, boolean } from 'drizzle-orm/pg-core'
import { clients, practices, practitionerProfiles } from './01-core'

export const simpleReports = pgTable('simple_reports', {
  simpleReportId: uuid('simple_report_id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  practitionerProfileId: uuid('practitioner_profile_id').notNull().references(() => practitionerProfiles.practitionerProfileId),
  reportType: text('report_type').notNull().default('phq9_progress'),
  reportTypeId: uuid('report_type_id'),
  reportDate: date('report_date'),
  dateRangeStart: date('date_range_start').notNull(),
  dateRangeEnd: date('date_range_end').notNull(),
  valuesSnapshotJson: jsonb('values_snapshot_json'),
  clinicalSummaryText: text('clinical_summary_text'),
  recommendationsText: text('recommendations_text'),
  letterBodyJson: jsonb('letter_body_json'),
  reportStatus: text('report_status').notNull().default('draft'),
  versionNumber: integer('version_number').notNull().default(1),
  isCurrentVersion: boolean('is_current_version').notNull().default(true),
  previousVersionId: uuid('previous_version_id'),
  pdfStoragePath: text('pdf_storage_path'),
  recipientType: text('recipient_type'),
  fundingApprovalId: uuid('funding_approval_id'),
  reportRequirementId: uuid('report_requirement_id'),
  finalisedAt: timestamp('finalised_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditEvents = pgTable('audit_events', {
  auditEventId: uuid('audit_event_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id').references(() => practices.practiceId),
  userId: uuid('user_id'),
  clientId: uuid('client_id').references(() => clients.clientId),
  eventType: text('event_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  actorMetadataJson: jsonb('actor_metadata_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
