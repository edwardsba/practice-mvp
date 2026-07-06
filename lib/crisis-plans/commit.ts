import { and, eq } from "drizzle-orm"

import { auditEvents, crisisPlans } from "@/db/schema"
import { db } from "@/lib/db"
import { formValuesToDbColumns } from "@/lib/crisis-plans/parse-form"
import { loadCrisisPlanForPractice } from "@/lib/crisis-plans/load"
import { syncEmergencyContacts } from "@/lib/crisis-plans/sync-emergency-contacts"
import type { CrisisPlanFormValues } from "@/lib/crisis-plans/types"

export async function commitCrisisPlan({
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
  values: CrisisPlanFormValues
}): Promise<{ crisisPlanId: string }> {
  const columns = formValuesToDbColumns(values)
  const now = new Date()

  if (!sourcePlanId) {
    let newPlanId!: string

    await db.transaction(async (tx) => {
      await syncEmergencyContacts(tx, {
        clientId,
        practiceId,
        userId,
        contacts: values.emergencyContacts,
      })

      const [plan] = await tx
        .insert(crisisPlans)
        .values({
          clientId,
          practiceId,
          practitionerProfileId,
          versionNumber: 1,
          isActive: true,
          ...columns,
          updatedAt: now,
        })
        .returning({ crisisPlanId: crisisPlans.crisisPlanId })

      newPlanId = plan.crisisPlanId

      await tx.insert(auditEvents).values({
        practiceId,
        userId,
        clientId,
        eventType: "crisis_plan.created",
        entityType: "crisis_plan",
        entityId: plan.crisisPlanId,
      })
    })

    return { crisisPlanId: newPlanId }
  }

  const sourcePlan = await loadCrisisPlanForPractice(
    sourcePlanId,
    clientId,
    practiceId
  )
  if (!sourcePlan) {
    throw new Error("Crisis plan not found.")
  }
  if (!sourcePlan.isActive) {
    throw new Error("Only the active crisis plan can be edited.")
  }

  const nextVersion = sourcePlan.versionNumber + 1
  let newPlanId!: string

  await db.transaction(async (tx) => {
    await syncEmergencyContacts(tx, {
      clientId,
      practiceId,
      userId,
      contacts: values.emergencyContacts,
    })

    await tx
      .update(crisisPlans)
      .set({ isActive: false, updatedAt: now })
      .where(
        and(
          eq(crisisPlans.clientId, clientId),
          eq(crisisPlans.practiceId, practiceId)
        )
      )

    const [plan] = await tx
      .insert(crisisPlans)
      .values({
        clientId,
        practiceId,
        practitionerProfileId,
        versionNumber: nextVersion,
        isActive: true,
        ...columns,
        updatedAt: now,
      })
      .returning({ crisisPlanId: crisisPlans.crisisPlanId })

    newPlanId = plan.crisisPlanId

    await tx.insert(auditEvents).values({
      practiceId,
      userId,
      clientId,
      eventType: "crisis_plan.updated",
      entityType: "crisis_plan",
      entityId: plan.crisisPlanId,
    })
  })

  return { crisisPlanId: newPlanId }
}
