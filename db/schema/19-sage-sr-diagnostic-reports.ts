import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, date } from 'drizzle-orm/pg-core'

import { clients, practices, practitionerProfiles } from './01-core'

// Client-specific report record — NOT a reference table (contrast sage_sr_diagnosis_reference /
// sage_sr_personality_criteria_reference in 18-sage-sr.ts, which are static and shared across
// every client). One row per generated SAGE-SR Diagnostic Report.
//
// Deliberately a separate table from simple_reports (04-reports-and-audit.ts), not a new
// simple_reports row: that table's dateRangeStart/dateRangeEnd are NOT NULL and it also carries
// letterBodyJson/recipientType/fundingApprovalId — none of which apply to a 5-section diagnostic
// synthesis document with no date range, no letter body, and no recipient. Confirmed with Ben:
// own table, own PDFKit renderer — reusing simple_reports' versioning conventions
// (versionNumber/isCurrentVersion/previousVersionId, matching both simple_reports and
// treatment_plans) without touching a pipeline that's live in production for other report types.
//
// The UI entry point still reuses the existing "Create Report" / report-type dropdown flow
// (report_types gets a new templateKey, e.g. "sage_sr_diagnostic") — this table is what that
// flow writes to once the selected type is the SAGE-SR one, per the confirmed design.
export const sageSrDiagnosticReports = pgTable('sage_sr_diagnostic_reports', {
  sageSrDiagnosticReportId: uuid('sage_sr_diagnostic_report_id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  practitionerProfileId: uuid('practitioner_profile_id')
    .notNull()
    .references(() => practitionerProfiles.practitionerProfileId),
  reportDate: date('report_date'),
  // Which specific assessmentInstance was selected per module, via the checkbox-selection UI
  // (mirroring report-form.tsx's existing appointment-selection pattern) — not "most recent",
  // the practitioner picks. Shape: { core: instanceId, background: instanceId | null,
  // personality: instanceId | null }. Core is required; Background/Personality are optional.
  selectedInstancesJson: jsonb('selected_instances_json').notNull(),
  // Snapshot of the five generators' output at generation time — same "freeze what was shown"
  // principle as simple_reports' valuesSnapshotJson / ReportSnapshot, so a later correction to
  // parsing/reference data doesn't silently change what an already-finalised report says.
  generatedContentJson: jsonb('generated_content_json'),
  // Practitioner's editable working copy, seeded from generatedContentJson at draft-create
  // time. This is the source of truth for the PDF renderer and the finalised view —
  // generatedContentJson itself is never touched after the initial save.
  editedContentJson: jsonb('edited_content_json'),
  reportStatus: text('report_status').notNull().default('draft'),
  versionNumber: integer('version_number').notNull().default(1),
  isCurrentVersion: boolean('is_current_version').notNull().default(true),
  previousVersionId: uuid('previous_version_id'),
  pdfStoragePath: text('pdf_storage_path'),
  finalisedAt: timestamp('finalised_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
