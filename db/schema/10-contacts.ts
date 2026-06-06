import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { practices } from './01-core'

export const professions = pgTable('professions', {
  professionId: uuid('profession_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id')
    .notNull()
    .references(() => practices.practiceId),
  professionName: text('profession_name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const professionalOrganisations = pgTable('professional_organisations', {
  organisationId: uuid('organisation_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id')
    .notNull()
    .references(() => practices.practiceId),
  organisationName: text('organisation_name').notNull(),
  streetAddress: text('street_address'),
  postalAddress: text('postal_address'),
  phone: text('phone'),
  fax: text('fax'),
  email: text('email'),
  claimsEmail: text('claims_email'),
  secureMessaging: text('secure_messaging'),
  website: text('website'),
  organisationType: text('organisation_type'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const professionals = pgTable('professionals', {
  professionalId: uuid('professional_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id')
    .notNull()
    .references(() => practices.practiceId),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  title: text('title'),
  professionId: uuid('profession_id').references(() => professions.professionId),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const professionalOrganisationLinks = pgTable(
  'professional_organisation_links',
  {
    linkId: uuid('link_id').primaryKey().defaultRandom(),
    professionalId: uuid('professional_id')
      .notNull()
      .references(() => professionals.professionalId),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => professionalOrganisations.organisationId),
    medicareProviderNumber: text('medicare_provider_number'),
    directPhone: text('direct_phone'),
    directEmail: text('direct_email'),
    directSecureMessaging: text('direct_secure_messaging'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
)
