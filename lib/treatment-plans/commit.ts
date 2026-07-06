import { and, eq } from "drizzle-orm"

import { auditEvents, treatmentPlans } from "@/db/schema"
import { db } from "@/lib/db"
import { formValuesToDbColumns } from "@/lib/treatment-plans/parse-form"
import { loadTreatmentPlanForPractice } from "@/lib/treatment-plans/load"
import type { TreatmentPlanFormValues } from "@/lib/treatment-plans/types"

function dayBeforeDateString(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() - 1)
  return date.toISOString().slice(0, 10)
}

export async function commitTreatmentPlan({
  clientId,
  practiceId,
  practitionerProfileId,
  userId,
  sourcePlanId,
  values,
}: {
  clientId: string
  practiceId: string
  practitionerProfileId: string
  userId: string
  sourcePlanId: string | null
  values: TreatmentPlanFormValues
}): Promise<{ treatmentPlanId: string }> {
  const columns = formValuesToDbColumns(values)
  const now = new Date()

  if (!sourcePlanId) {
    let newPlanId!: string

    await db.transaction(async (tx) => {
      const [plan] = await tx
        .insert(treatmentPlans)
        .values({
          clientId,
          practiceId,
          practitionerProfileId,
          versionNumber: 1,
          isActive: true,
          ...columns,
          updatedAt: now,
        })
        .returning({ treatmentPlanId: treatmentPlans.treatmentPlanId })

      newPlanId = plan.treatmentPlanId

      await tx.insert(auditEvents).values({
        practiceId,
        userId,
        clientId,
        eventType: "treatment_plan.created",
        entityType: "treatment_plan",
        entityId: plan.treatmentPlanId,
      })
    })

    return { treatmentPlanId: newPlanId }
  }

  const sourcePlan = await loadTreatmentPlanForPractice(
    sourcePlanId,
    clientId,
    practiceId
  )
  if (!sourcePlan) {
    throw new Error("Treatment plan not found.")
  }

  const nextVersion = sourcePlan.versionNumber + 1
  let newPlanId!: string

  await db.transaction(async (tx) => {
    await tx
      .update(treatmentPlans)
      .set({ isActive: false, updatedAt: now })
      .where(
        and(
          eq(treatmentPlans.clientId, clientId),
          eq(treatmentPlans.practiceId, practiceId)
        )
      )

    if (columns.startDate) {
      await tx
        .update(treatmentPlans)
        .set({
          endDate: dayBeforeDateString(columns.startDate),
          updatedAt: now,
        })
        .where(eq(treatmentPlans.treatmentPlanId, sourcePlanId))
    }

    const [plan] = await tx
      .insert(treatmentPlans)
      .values({
        clientId,
        practiceId,
        practitionerProfileId,
        versionNumber: nextVersion,
        isActive: true,
        ...columns,
        updatedAt: now,
      })
      .returning({ treatmentPlanId: treatmentPlans.treatmentPlanId })

    newPlanId = plan.treatmentPlanId

    await tx.insert(auditEvents).values({
      practiceId,
      userId,
      clientId,
      eventType: "treatment_plan.updated",
      entityType: "treatment_plan",
      entityId: plan.treatmentPlanId,
    })
  })

  return { treatmentPlanId: newPlanId }
}
