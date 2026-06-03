import { pgTable, uuid, text, boolean, timestamp, customType } from 'drizzle-orm/pg-core'

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
  timezone: text('timezone').notNull().default('Australia/Sydney'),
  address: text('address'),
  phone: text('phone'),
  email: citext('email'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const practitionerProfiles = pgTable('practitioner_profiles', {
  practitionerProfileId: uuid('practitioner_profile_id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.userId),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  title: text('title'),
  fullName: text('full_name').notNull(),
  registrationNumber: text('registration_number'),
  registrationBody: text('registration_body'),
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
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
