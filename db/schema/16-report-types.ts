import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { practices } from './01-core'

export const reportTypes = pgTable('report_types', {
  reportTypeId: uuid('report_type_id').primaryKey().defaultRandom(),
  practiceId: uuid('practice_id').notNull().references(() => practices.practiceId),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
