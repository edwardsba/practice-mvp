import { pgTable, uuid, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'
import { clients, practices } from './01-core'
import { professionals, professionalOrganisations } from './10-contacts'

export const claimTypes = pgTable('claim_types', {
  claimTypeId: uuid('claim_type_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  claimTypeName: text('claim_type_name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const fundingApprovalTypes = pgTable('funding_approval_types', {
  fundingApprovalTypeId: uuid('funding_approval_type_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  name: text('name').notNull(),
  claimTypeId: uuid('claim_type_id').references(() => claimTypes.claimTypeId),
  durationMonths: integer('duration_months'),
  appointmentsApproved: integer('appointments_approved'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const fundingApprovalTypeReports = pgTable('funding_approval_type_reports', {
  reportRequirementId: uuid('report_requirement_id').primaryKey().defaultRandom(),
  fundingApprovalTypeId: uuid('funding_approval_type_id')
    .notNull()
    .references(() => fundingApprovalTypes.fundingApprovalTypeId),
  appointmentNumber: integer('appointment_number').notNull(),
  reportType: text('report_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const claims = pgTable('claims', {
  claimId: uuid('claim_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  claimTypeId: uuid('claim_type_id').notNull().references(() => claimTypes.claimTypeId),
  medicareCardNumber: text('medicare_card_number'),
  medicareIrn: text('medicare_irn'),
  insuranceOrganisationId: uuid('insurance_organisation_id')
    .references(() => professionalOrganisations.organisationId),
  insuranceReferenceNumber: text('insurance_reference_number'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const fundingApprovals = pgTable('funding_approvals', {
  fundingApprovalId: uuid('funding_approval_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  clientId: uuid('client_id').notNull().references(() => clients.clientId),
  claimId: uuid('claim_id').references(() => claims.claimId),
  fundingApprovalTypeId: uuid('funding_approval_type_id')
    .references(() => fundingApprovalTypes.fundingApprovalTypeId),
  referrerId: uuid('referrer_id')
    .references(() => professionals.professionalId),
  startDate: text('start_date'),
  endDate: text('end_date'),
  appointmentsApproved: integer('appointments_approved'),
  approvalStatus: text('approval_status').notNull().default('active'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const fundingApprovalReportLinks = pgTable('funding_approval_report_links', {
  linkId: uuid('link_id').primaryKey().defaultRandom(),
  fundingApprovalId: uuid('funding_approval_id')
    .notNull()
    .references(() => fundingApprovals.fundingApprovalId),
  appointmentNumber: integer('appointment_number').notNull(),
  reportType: text('report_type').notNull(),
  simpleReportId: uuid('simple_report_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
