import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core'

export const assessmentDefinitions = pgTable('assessment_definitions', {
  assessmentDefinitionId: uuid('assessment_definition_id').primaryKey().defaultRandom(),
  assessmentCode: text('assessment_code').notNull().unique(),
  assessmentName: text('assessment_name').notNull(),
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
