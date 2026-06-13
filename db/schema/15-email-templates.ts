import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { practices } from "./01-core"

export const emailTemplates = pgTable("email_templates", {
  emailTemplateId: uuid("email_template_id").primaryKey().defaultRandom(),
  practiceId: uuid("practice_id")
    .notNull()
    .references(() => practices.practiceId),
  templateKey: text("template_key"),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  defaultCc: text("default_cc"),
  defaultBcc: text("default_bcc"),
  hasActionButton: boolean("has_action_button").notNull().default(false),
  actionButtonLabel: text("action_button_label"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
