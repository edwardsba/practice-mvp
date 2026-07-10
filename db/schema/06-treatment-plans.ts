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
  therapeuticTarget: text('therapeutic_target'),
  behaviouralTargetsJson: jsonb('behavioural_targets_json'),
  ongoingAssessmentsJson: jsonb('ongoing_assessments_json'),
  riskManagementJson: jsonb('risk_management_json'),
  suicideAttemptsJson: jsonb('suicide_attempts_json'),
  supportServicesJson: jsonb('support_services_json'),
  psychoeducationJson: jsonb('psychoeducation_json'),
  caseFormulationJson: jsonb('case_formulation_json'),
  alternateResponsesJson: jsonb('alternate_responses_json'),
  qualityOfLifeJson: jsonb('quality_of_life_json'),
  pdfStoragePath: text('pdf_storage_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
