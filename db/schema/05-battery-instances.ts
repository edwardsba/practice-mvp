import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { clients, practices, practitionerProfiles } from './01-core'
import { assessmentInstances, assessmentAccessLinks } from './03-assessment-instances'

export const batteryInstances = pgTable('battery_instances', {
  batteryInstanceId: uuid('battery_instance_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practitionerProfileId: uuid('practitioner_profile_id').notNull().references(() => practitionerProfiles.practitionerProfileId),
  batteryCode: text('battery_code').notNull().default('PRE_SESSION'),
  phq9InstanceId: uuid('phq9_instance_id').notNull().references(() => assessmentInstances.assessmentInstanceId),
  gad7InstanceId: uuid('gad7_instance_id').notNull().references(() => assessmentInstances.assessmentInstanceId),
  phq9LinkId: uuid('phq9_link_id').notNull().references(() => assessmentAccessLinks.assessmentAccessLinkId),
  gad7LinkId: uuid('gad7_link_id').notNull().references(() => assessmentAccessLinks.assessmentAccessLinkId),
  btpInstanceId: uuid('btp_instance_id').references(() => assessmentInstances.assessmentInstanceId),
  btpLinkId: uuid('btp_link_id').references(() => assessmentAccessLinks.assessmentAccessLinkId),
  assistInstanceId: uuid('assist_instance_id').references(() => assessmentInstances.assessmentInstanceId),
  assistLinkId: uuid('assist_link_id').references(() => assessmentAccessLinks.assessmentAccessLinkId),
  firstLinkId: uuid('first_link_id').references(() => assessmentAccessLinks.assessmentAccessLinkId),
  lastLinkId: uuid('last_link_id').references(() => assessmentAccessLinks.assessmentAccessLinkId),
  status: text('status').notNull().default('assigned'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
