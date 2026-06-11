import { and, desc, eq } from "drizzle-orm"

import { communications } from "@/db/schema"
import { db } from "@/lib/db"

export async function loadCommunicationsForClient(
  clientId: string,
  practiceId: string
) {
  return db
    .select({
      communicationId: communications.communicationId,
      sentAt: communications.sentAt,
      templateType: communications.templateType,
      toEmail: communications.toEmail,
      ccEmail: communications.ccEmail,
      bccEmail: communications.bccEmail,
      subject: communications.subject,
      messageText: communications.messageText,
      status: communications.status,
      errorMessage: communications.errorMessage,
    })
    .from(communications)
    .where(
      and(
        eq(communications.clientId, clientId),
        eq(communications.practiceId, practiceId)
      )
    )
    .orderBy(desc(communications.sentAt))
}
