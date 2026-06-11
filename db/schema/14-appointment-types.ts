import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { practices } from "./01-core"
import { practitionerPracticeMemberships } from "./11-practitioner-practice"
import { claimTypes } from "./12-funding"

export const appointmentTypes = pgTable("appointment_types", {
  appointmentTypeId: uuid("appointment_type_id").primaryKey().defaultRandom(),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.practiceId),
  nickname: text("nickname").notNull(),
  name: text("name").notNull(),
  referenceNumber: text("reference_number"),
  claimTypeId: uuid("claim_type_id").references(() => claimTypes.claimTypeId),
  membershipId: uuid("membership_id").references(
    () => practitionerPracticeMemberships.membershipId
  ),
  durationMinutes: integer("duration_minutes").notNull().default(50),
  status: text("status").notNull().default("active"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const appointmentTypeFees = pgTable("appointment_type_fees", {
  feeId: uuid("fee_id").primaryKey().defaultRandom(),
  appointmentTypeId: uuid("appointment_type_id")
    .notNull()
    .references(() => appointmentTypes.appointmentTypeId),
  fee: numeric("fee", { precision: 10, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
