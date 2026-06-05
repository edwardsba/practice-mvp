import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { clients, practices, practitionerProfiles } from './01-core'

export const clientEmergencyContacts = pgTable('client_emergency_contacts', {
  contactId: uuid('contact_id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  role: text('role'),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crisisPlans = pgTable('crisis_plans', {
  crisisPlanId: uuid('crisis_plan_id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  practitionerProfileId: uuid('practitioner_profile_id')
    .notNull()
    .references(() => practitionerProfiles.practitionerProfileId),
  versionNumber: integer('version_number').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  dateOfPlan: date('date_of_plan').notNull(),
  emergencyNumbersJson: jsonb('emergency_numbers_json'),
  doingWellJson: jsonb('doing_well_json'),
  stayWellJson: jsonb('stay_well_json'),
  becomingUnwellJson: jsonb('becoming_unwell_json'),
  getBetterJson: jsonb('get_better_json'),
  unwellJson: jsonb('unwell_json'),
  crisisResponseJson: jsonb('crisis_response_json'),
  pdfStoragePath: text('pdf_storage_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
