import { boolean, date, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { clients, practices, practitionerProfiles } from './01-core'

export const treatmentPlans = pgTable('treatment_plans', {
  treatmentPlanId: uuid('treatment_plan_id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  practitionerProfileId: uuid('practitioner_profile_id')
    .notNull()
    .references(() => practitionerProfiles.practitionerProfileId),
  versionNumber: integer('version_number').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  startDate: date('start_date'),
  endDate: date('end_date'),
  // Manually entered for now — a plain synthesis statement the practitioner types in.
  // Once the standalone diagnostic-assessment feature exists, this field will be
  // autofilled from it instead (see PROJECT_MAP.md Clinical Process #8).
  diagnosis: text('diagnosis'),
  // Date of the report/assessment the diagnosis above is based on — separate from
  // the plan's own createdAt/startDate.
  diagnosisReportDate: date('diagnosis_report_date'),
  therapeuticTarget: text('therapeutic_target'),
  // Renamed from behaviouralTargetsJson (2026-09 layout update) — same
  // { items: string[] } shape, product concept renamed to "SMART Goals".
  smartGoalsJson: jsonb('smart_goals_json'),
  treatmentModalitiesJson: jsonb('treatment_modalities_json'),
  ongoingAssessmentsJson: jsonb('ongoing_assessments_json'),
  suicideAttemptsJson: jsonb('suicide_attempts_json'),
  // Medication supervision is its own compound field (not a plain checkbox item):
  // whether medication is currently being supervised, and by whom.
  medicationSupervisionJson: jsonb('medication_supervision_json'),
  supportServicesJson: jsonb('support_services_json'),
  // Renamed from caseFormulationJson (2026-09 layout update) and changed from a
  // multi-select list to a single-select: exactly one named, cited treatment model
  // per plan, shape { selected: string | null }. No "Other" free-text — these need
  // to be exact citations. Section title in the UI is "Treatment Model".
  treatmentModelJson: jsonb('treatment_model_json'),
  // Psychoeducation / Alternate Responses / Quality of Life removed (2026-09 layout
  // update) — replaced by the static "Treatment Summary" block, which has no
  // per-client selectable state and so needs no column.
  pdfStoragePath: text('pdf_storage_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
