import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core'

export const assessmentDefinitions = pgTable('assessment_definitions', {
  assessmentDefinitionId: uuid('assessment_definition_id').primaryKey().defaultRandom(),
  assessmentCode: text('assessment_code').notNull().unique(),
  assessmentName: text('assessment_name').notNull(),
  // Short, plain-language name shown to clients as the page title on /q/[token] — the
  // full assessmentName above (e.g. "DSM-5-TR Severity Measure for Panic Disorder—Adult")
  // stays as the admin/technical name everywhere else. Nullable: falls back to
  // assessmentName if not yet set for a given instrument.
  clientDisplayName: text('client_display_name'),
  assessmentType: text('assessment_type').notNull().default('psychometric_assessment'),
  description: text('description'),
  scoringEnabled: boolean('scoring_enabled').notNull().default(true),
  clientCompletable: boolean('client_completable').notNull().default(true),
  practitionerCompletable: boolean('practitioner_completable').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assessmentElements = pgTable('assessment_elements', {
  assessmentElementId: uuid('assessment_element_id').primaryKey().defaultRandom(),
  assessmentDefinitionId: uuid('assessment_definition_id').notNull().references(() => assessmentDefinitions.assessmentDefinitionId),
  assessmentInstanceId: uuid('assessment_instance_id'),
  elementKey: text('element_key').notNull().unique(),
  questionText: text('question_text').notNull(),
  elementType: text('element_type').notNull().default('radio'),
  dataType: text('data_type').notNull().default('integer'),
  displayOrder: integer('display_order').notNull(),
  isRequired: boolean('is_required').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  groupLabel: text('group_label'), // e.g. "Presentation", "Mental Function", "Discernment"
  subgroupLabel: text('subgroup_label'), // e.g. "Perceptions", "Thoughts", "Cognitions" — null if the assessment has no secondary grouping
  domainCode: text('domain_code'), // e.g. 'depression', 'anxiety', 'psychosis' — used by battery_trigger_rules to evaluate Level 1 XC domain flags. Null for non-diagnostic-battery assessments.
  isUrgentFlag: boolean('is_urgent_flag').notNull().default(false), // true only for the SI item (Level 1 XC #11) — drives the highlighted row in the Diagnostic Assessment Report
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const assessmentOptions = pgTable('assessment_options', {
  assessmentOptionId: uuid('assessment_option_id').primaryKey().defaultRandom(),
  assessmentElementId: uuid('assessment_element_id').notNull().references(() => assessmentElements.assessmentElementId),
  assessmentDefinitionId: uuid('assessment_definition_id').notNull().references(() => assessmentDefinitions.assessmentDefinitionId),
  optionLabel: text('option_label').notNull(),
  optionValue: text('option_value').notNull(),
  scoreValue: integer('score_value').notNull(),
  displayOrder: integer('display_order').notNull(),
  isDefaultSelection: boolean('is_default_selection').notNull().default(false),
  isReportingBaseline: boolean('is_reporting_baseline').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
