import { and, eq } from "drizzle-orm"

import { emailTemplates } from "@/db/schema"
import { db } from "@/lib/db"

export async function getEmailTemplateByKey(
  practiceId: string,
  templateKey: string
) {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.practiceId, practiceId),
        eq(emailTemplates.templateKey, templateKey),
        eq(emailTemplates.isActive, true)
      )
    )
    .limit(1)

  return template ?? null
}
