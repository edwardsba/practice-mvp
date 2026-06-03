"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { assessmentResults, auditEvents } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type MarkReviewedState = {
  error?: string
  success?: boolean
}

export async function markResultAsReviewed(
  clientId: string,
  resultId: string,
  _prevState: MarkReviewedState,
  _formData: FormData
): Promise<MarkReviewedState> {
  const context = await requirePractitionerContext()

  const [result] = await db
    .select({
      assessmentResultId: assessmentResults.assessmentResultId,
      status: assessmentResults.status,
    })
    .from(assessmentResults)
    .where(
      and(
        eq(assessmentResults.assessmentResultId, resultId),
        eq(assessmentResults.clientId, clientId),
        eq(assessmentResults.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!result) {
    return { error: "Result not found." }
  }

  if (result.status === "reviewed") {
    return { success: true }
  }

  await db
    .update(assessmentResults)
    .set({ status: "reviewed" })
    .where(eq(assessmentResults.assessmentResultId, resultId))

  await db.insert(auditEvents).values({
    practiceId: context.practiceId,
    userId: context.userId,
    clientId,
    eventType: "assessment_result.reviewed",
    entityType: "assessment_result",
    entityId: resultId,
  })

  revalidatePath(`/clients/${clientId}/results/${resultId}`)
  revalidatePath(`/clients/${clientId}`)

  return { success: true }
}
