import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { clients, practices, practitionerProfiles } from './01-core'
import { assessmentInstances, assessmentAccessLinks } from './03-assessment-instances'

// One row per administration of the whole adaptive battery (an intake, or an annual re-administration).
// Deliberately separate from `battery_instances` (which stays exactly as-is for PRE_SESSION) — this is a
// different battery type with a different shape (variable-length, branching), not a fixed set of 4 instruments.
export const diagnosticBatteryInstances = pgTable('diagnostic_battery_instances', {
  diagnosticBatteryInstanceId: uuid('diagnostic_battery_instance_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practitionerProfileId: uuid('practitioner_profile_id').notNull().references(() => practitionerProfiles.practitionerProfileId),
  batteryCode: text('battery_code').notNull().default('DIAGNOSTIC_INTAKE'), // 'DIAGNOSTIC_INTAKE' | 'DIAGNOSTIC_ANNUAL'
  status: text('status').notNull().default('assigned'), // assigned | in_progress | complete
  firstLinkId: uuid('first_link_id').references(() => assessmentAccessLinks.assessmentAccessLinkId),
  lastLinkId: uuid('last_link_id').references(() => assessmentAccessLinks.assessmentAccessLinkId),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// One row per instrument actually queued/completed within a diagnostic battery instance.
// Variable length by design — a client who flags nothing at Tier 1 has 1-3 rows (Level 1 XC + PC-PTSD-5 + ASRS A),
// a client who flags everything could have 15+.
export const batteryInstanceModules = pgTable('battery_instance_modules', {
  batteryInstanceModuleId: uuid('battery_instance_module_id').primaryKey().defaultRandom(),
  diagnosticBatteryInstanceId: uuid('diagnostic_battery_instance_id').notNull().references(() => diagnosticBatteryInstances.diagnosticBatteryInstanceId),
  assessmentInstanceId: uuid('assessment_instance_id').notNull().references(() => assessmentInstances.assessmentInstanceId),
  assessmentAccessLinkId: uuid('assessment_access_link_id').notNull().references(() => assessmentAccessLinks.assessmentAccessLinkId),
  assessmentCode: text('assessment_code').notNull(), // denormalized for quick lookup without a join
  tier: text('tier').notNull(), // 'tier_1' | 'tier_2' | 'tier_3'
  moduleOrder: integer('module_order').notNull(), // position in the resolved chain
  triggeredByModuleId: uuid('triggered_by_module_id'), // self-reference: which prior module's result triggered this one. Null for baseline Tier 1 modules.
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Data-driven thresholds — lets you adjust trigger points (e.g. the Anxiety→subtype-selector threshold,
// or the PID-5-BF→FBF threshold) without a code change, since several of these don't have an official cutoff.
export const batteryTriggerRules = pgTable('battery_trigger_rules', {
  batteryTriggerRuleId: uuid('battery_trigger_rule_id').primaryKey().defaultRandom(),
  ruleCode: text('rule_code').notNull().unique(), // e.g. 'anxiety_subtype_selector', 'pid5bf_to_fbf'
  sourceAssessmentCode: text('source_assessment_code').notNull(), // which assessment's result this rule reads
  domainCode: text('domain_code'), // matches assessment_elements.domain_code — null if the rule reads a total score rather than a domain
  comparisonOperator: text('comparison_operator').notNull(), // 'gte' | 'gt' | 'eq'
  thresholdValue: integer('threshold_value').notNull(),
  targetAssessmentCode: text('target_assessment_code').notNull(), // which assessment gets queued when the rule fires
  targetTier: text('target_tier').notNull(), // 'tier_1' | 'tier_2' | 'tier_3' — the tier of the assessment being queued, written onto its battery_instance_modules row
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
