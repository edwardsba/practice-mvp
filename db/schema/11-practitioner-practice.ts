import { pgTable, uuid, text, boolean, timestamp, time, integer } from 'drizzle-orm/pg-core'
import { practitionerProfiles, practices } from './01-core'

export const practitionerPracticeMemberships = pgTable('practitioner_practice_memberships', {
  membershipId: uuid('membership_id').primaryKey().defaultRandom(),
  practitionerProfileId: uuid('practitioner_profile_id')
    .notNull()
    .references(() => practitionerProfiles.practitionerProfileId),
  practiceId: uuid('practice_id')
    .notNull()
    .references(() => practices.practiceId),
  medicareProviderNumber: text('medicare_provider_number'),
  role: text('role'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const practitionerAvailabilityBlocks = pgTable('practitioner_availability_blocks', {
  blockId: uuid('block_id').primaryKey().defaultRandom(),
  membershipId: uuid('membership_id')
    .notNull()
    .references(() => practitionerPracticeMemberships.membershipId),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  mode: text('mode').notNull().default('both'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
