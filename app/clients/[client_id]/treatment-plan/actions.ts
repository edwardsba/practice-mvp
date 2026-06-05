"use server"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { auditEvents, treatmentPlans } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  formValuesToDbColumns,
  parseTreatmentPlanFormData,
} from "@/lib/treatment-plans/parse-form"
import { loadTreatmentPlanForPractice, verifyClientInPractice } from "@/lib/treatment-plans/load"
import type { TreatmentPlanFormState } from "@/components/treatment-plan/treatment-plan-form"

export async function createTreatmentPlan(
  clientId: string,
  _prevState: TreatmentPlanFormState,
  formData: FormData
): Promise<TreatmentPlanFormState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)

  if (!client) {
    return { error: "Client not found." }
  }

  const values = parseTreatmentPlanFormData(formData)
  const columns = formValuesToDbColumns(values)
  const now = new Date()

  let newPlanId: string

  try {
    await db.transaction(async (tx) => {
      const [plan] = await tx
        .insert(treatmentPlans)
        .values({
          clientId,
          practiceId: context.practiceId,
          practitionerProfileId: context.practitionerProfileId,
          versionNumber: 1,
          isActive: true,
          ...columns,
          updatedAt: now,
        })
        .returning({ treatmentPlanId: treatmentPlans.treatmentPlanId })

      newPlanId = plan.treatmentPlanId

      await tx.insert(auditEvents).values({
        practiceId: context.practiceId,
        userId: context.userId,
        clientId,
        eventType: "treatment_plan.created",
        entityType: "treatment_plan",
        entityId: plan.treatmentPlanId,
      })
    })
  } catch {
    return { error: "Unable to save treatment plan. Please try again." }
  }

  revalidatePath(`/clients/${clientId}`)
  redirect(`/clients/${clientId}/treatment-plan/${newPlanId!}`)
}

export async function createTreatmentPlanVersion(
  clientId: string,
  sourcePlanId: string,
  _prevState: TreatmentPlanFormState,
  formData: FormData
): Promise<TreatmentPlanFormState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)

  if (!client) {
    return { error: "Client not found." }
  }

  const sourcePlan = await loadTreatmentPlanForPractice(
    sourcePlanId,
    clientId,
    context.practiceId
  )

  if (!sourcePlan) {
    return { error: "Treatment plan not found." }
  }

  const values = parseTreatmentPlanFormData(formData)
  const columns = formValuesToDbColumns(values)
  const now = new Date()
  const nextVersion = sourcePlan.versionNumber + 1

  let newPlanId: string

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(treatmentPlans)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(
            eq(treatmentPlans.clientId, clientId),
            eq(treatmentPlans.practiceId, context.practiceId)
          )
        )

      const [plan] = await tx
        .insert(treatmentPlans)
        .values({
          clientId,
          practiceId: context.practiceId,
          practitionerProfileId: context.practitionerProfileId,
          versionNumber: nextVersion,
          isActive: true,
          ...columns,
          updatedAt: now,
        })
        .returning({ treatmentPlanId: treatmentPlans.treatmentPlanId })

      newPlanId = plan.treatmentPlanId

      await tx.insert(auditEvents).values({
        practiceId: context.practiceId,
        userId: context.userId,
        clientId,
        eventType: "treatment_plan.updated",
        entityType: "treatment_plan",
        entityId: plan.treatmentPlanId,
      })
    })
  } catch {
    return { error: "Unable to save treatment plan. Please try again." }
  }

  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/treatment-plan/${sourcePlanId}`)
  redirect(`/clients/${clientId}/treatment-plan/${newPlanId!}`)
}
