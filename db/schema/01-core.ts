import { pgTable, uuid, text, boolean, timestamp, customType, time, integer } from 'drizzle-orm/pg-core'

const citext = customType<{ data: string }>({
  dataType() {
    return 'citext'
  },
})

export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  email: citext('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('practitioner'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const practices = pgTable('practices', {
  practiceId: uuid('practice_id').primaryKey().defaultRandom(),
  practiceName: text('practice_name').notNull(),
  locationNickname: text('location_nickname'),
  timezone: text('timezone').notNull().default('Australia/Sydney'),
  address: text('address'),
  phone: text('phone'),
  fax: text('fax'),
  email: citext('email'),
  website: text('website'),
  abn: text('abn'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const practitionerProfiles = pgTable('practitioner_profiles', {
  practitionerProfileId: uuid('practitioner_profile_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId),
  title: text('title'),
  firstName: text('first_name').notNull(),
  preferredName: text('preferred_name'),
  lastName: text('last_name').notNull(),
  registrationNumber: text('registration_number'),
  registrationBody: text('registration_body'),
  phone: text('phone'),
  email: citext('email'),
  reportSignature: text('report_signature'),
  signatureImagePath: text('signature_image_path'),
  calendarStartTime: time('calendar_start_time').notNull().default('07:00'),
  calendarEndTime: time('calendar_end_time').notNull().default('20:00'),
  calendarIntervalMinutes: integer('calendar_interval_minutes').notNull().default(30),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const clients = pgTable('clients', {
  clientId: uuid('client_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  dateOfBirth: text('date_of_birth'),
  email: citext('email'),
  phone: text('phone'),
  address: text('address'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  clientStatus: text('client_status').notNull().default('active'),
  commsOptOut: boolean('comms_opt_out').notNull().default(false),
  reminderOptOut: boolean('reminder_opt_out').notNull().default(false),
  preSessionOptOut: boolean('pre_session_opt_out').notNull().default(false),
  postSessionOptOut: boolean('post_session_opt_out').notNull().default(false),
  adminCommsOptOut: boolean('admin_comms_opt_out').notNull().default(false),
  onlineBookingPermitted: boolean('online_booking_permitted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
