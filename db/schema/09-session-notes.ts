import { boolean, date, integer, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core'

import { clients, practices, practitionerProfiles } from './01-core'
import { batteryInstances } from './05-battery-instances'
import { appointments } from './08-appointments'

export const sessionNotes = pgTable('session_notes', {
  sessionNoteId: uuid('session_note_id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  practitionerProfileId: uuid('practitioner_profile_id')
    .notNull()
    .references(() => practitionerProfiles.practitionerProfileId),
  appointmentId: uuid('appointment_id').references(() => appointments.appointmentId),
  batteryInstanceId: uuid('battery_instance_id').references(
    () => batteryInstances.batteryInstanceId
  ),
  sessionDate: date('session_date').notNull(),
  sessionTime: time('session_time'),
  practitionerNotes: text('practitioner_notes'),
  status: text('status').notNull().default('draft'),
  isActive: boolean('is_active').notNull().default(true),
  finalisedAt: timestamp('finalised_at', { withTimezone: true }),
  pdfStoragePath: text('pdf_storage_path'),
  versionNumber: integer('version_number').notNull().default(1),
  isCurrentVersion: boolean('is_current_version').notNull().default(true),
  previousVersionId: uuid('previous_version_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
