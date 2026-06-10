import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { clients, practices, practitionerProfiles } from "./01-core"
import { assessmentAccessLinks } from "./03-assessment-instances"

export const communications = pgTable("communications", {
  communicationId: uuid("communication_id").primaryKey().defaultRandom(),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.practiceId),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.clientId),
  practitionerProfileId: uuid("practitioner_profile_id")
    .notNull()
    .references(() => practitionerProfiles.practitionerProfileId),
  templateType: text("template_type").notNull(),
  toEmail: text("to_email").notNull(),
  ccEmail: text("cc_email"),
  bccEmail: text("bcc_email"),
  subject: text("subject").notNull(),
  messageText: text("message_text"),
  assessmentAccessLinkId: uuid("assessment_access_link_id").references(
    () => assessmentAccessLinks.assessmentAccessLinkId
  ),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("sent"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
