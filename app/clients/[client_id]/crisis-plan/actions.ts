"use server"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { auditEvents, crisisPlans } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  loadCrisisPlanForPractice,
  verifyClientInPractice,
} from "@/lib/crisis-plans/load"
import {
  formValuesToDbColumns,
  parseCrisisPlanFormData,
} from "@/lib/crisis-plans/parse-form"
import { syncEmergencyContacts } from "@/lib/crisis-plans/sync-emergency-contacts"

export type CrisisPlanFormState = {
  error?: string
}

export async function createCrisisPlan(
  clientId: string,
  _prevState: CrisisPlanFormState,
  formData: FormData
): Promise<CrisisPlanFormState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)

  if (!client) {
    return { error: "Client not found." }
  }

  let values
  try {
    values = parseCrisisPlanFormData(formData)
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Invalid crisis plan details.",
    }
  }

  const columns = formValuesToDbColumns(values)
  const now = new Date()
  let newPlanId: string

  try {
    await db.transaction(async (tx) => {
      await syncEmergencyContacts(tx, {
        clientId,
        practiceId: context.practiceId,
        userId: context.userId,
        contacts: values.emergencyContacts,
      })

      const [plan] = await tx
        .insert(crisisPlans)
        .values({
          clientId,
          practiceId: context.practiceId,
          practitionerProfileId: context.practitionerProfileId,
          versionNumber: 1,
          isActive: true,
          ...columns,
          updatedAt: now,
        })
        .returning({ crisisPlanId: crisisPlans.crisisPlanId })

      newPlanId = plan.crisisPlanId

      await tx.insert(auditEvents).values({
        practiceId: context.practiceId,
        userId: context.userId,
        clientId,
        eventType: "crisis_plan.created",
        entityType: "crisis_plan",
        entityId: plan.crisisPlanId,
      })
    })
  } catch {
    return { error: "Unable to save crisis plan. Please try again." }
  }

  revalidatePath(`/clients/${clientId}`)
  redirect(`/clients/${clientId}/crisis-plan/${newPlanId!}`)
}

export async function createCrisisPlanVersion(
  clientId: string,
  sourcePlanId: string,
  _prevState: CrisisPlanFormState,
  formData: FormData
): Promise<CrisisPlanFormState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)

  if (!client) {
    return { error: "Client not found." }
  }

  const sourcePlan = await loadCrisisPlanForPractice(
    sourcePlanId,
    clientId,
    context.practiceId
  )

  if (!sourcePlan) {
    return { error: "Crisis plan not found." }
  }

  if (!sourcePlan.isActive) {
    return { error: "Only the active crisis plan can be edited." }
  }

  let values
  try {
    values = parseCrisisPlanFormData(formData)
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Invalid crisis plan details.",
    }
  }

  const columns = formValuesToDbColumns(values)
  const now = new Date()
  const nextVersion = sourcePlan.versionNumber + 1
  let newPlanId: string

  try {
    await db.transaction(async (tx) => {
      await syncEmergencyContacts(tx, {
        clientId,
        practiceId: context.practiceId,
        userId: context.userId,
        contacts: values.emergencyContacts,
      })

      await tx
        .update(crisisPlans)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(
            eq(crisisPlans.clientId, clientId),
            eq(crisisPlans.practiceId, context.practiceId)
          )
        )

      const [plan] = await tx
        .insert(crisisPlans)
        .values({
          clientId,
          practiceId: context.practiceId,
          practitionerProfileId: context.practitionerProfileId,
          versionNumber: nextVersion,
          isActive: true,
          ...columns,
          updatedAt: now,
        })
        .returning({ crisisPlanId: crisisPlans.crisisPlanId })

      newPlanId = plan.crisisPlanId

      await tx.insert(auditEvents).values({
        practiceId: context.practiceId,
        userId: context.userId,
        clientId,
        eventType: "crisis_plan.updated",
        entityType: "crisis_plan",
        entityId: plan.crisisPlanId,
      })
    })
  } catch {
    return { error: "Unable to save crisis plan. Please try again." }
  }

  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/crisis-plan/${sourcePlanId}`)
  redirect(`/clients/${clientId}/crisis-plan/${newPlanId!}`)
}
