import { date, integer, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core'

import { clients, practices, practitionerProfiles } from './01-core'

export const appointments = pgTable('appointments', {
  appointmentId: uuid('appointment_id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  practitionerProfileId: uuid('practitioner_profile_id')
    .notNull()
    .references(() => practitionerProfiles.practitionerProfileId),
  appointmentDate: date('appointment_date').notNull(),
  appointmentTime: time('appointment_time').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(50),
  location: text('location'),
  mode: text('mode').notNull().default('face_to_face'),
  status: text('status').notNull().default('scheduled'),
  notes: text('notes'),
  reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
  preSessionBatterySentAt: timestamp('pre_session_battery_sent_at', {
    withTimezone: true,
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
