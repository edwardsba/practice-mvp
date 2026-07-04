import { and, desc, eq } from "drizzle-orm"

import { clients, treatmentPlans } from "@/db/schema"
import { rowToTreatmentPlan } from "@/lib/treatment-plans/serialize"
import type {
  OngoingAssessmentsJson,
  TreatmentPlanRow,
} from "@/lib/treatment-plans/types"
import { db } from "@/lib/db"

export async function loadTreatmentPlanForPractice(
  treatmentPlanId: string,
  clientId: string,
  practiceId: string
): Promise<TreatmentPlanRow | null> {
  const [row] = await db
    .select()
    .from(treatmentPlans)
    .where(
      and(
        eq(treatmentPlans.treatmentPlanId, treatmentPlanId),
        eq(treatmentPlans.clientId, clientId),
        eq(treatmentPlans.practiceId, practiceId)
      )
    )
    .limit(1)

  if (!row) return null
  return rowToTreatmentPlan(row)
}

export async function loadTreatmentPlanVersions(
  clientId: string,
  practiceId: string
) {
  const rows = await db
    .select({
      treatmentPlanId: treatmentPlans.treatmentPlanId,
      versionNumber: treatmentPlans.versionNumber,
      isActive: treatmentPlans.isActive,
      startDate: treatmentPlans.startDate,
      therapeuticTarget: treatmentPlans.therapeuticTarget,
      createdAt: treatmentPlans.createdAt,
    })
    .from(treatmentPlans)
    .where(
      and(
        eq(treatmentPlans.clientId, clientId),
        eq(treatmentPlans.practiceId, practiceId)
      )
    )
    .orderBy(desc(treatmentPlans.versionNumber))

  return rows
}

function parseBehaviouralTargetItems(value: unknown): string[] {
  if (!value || typeof value !== "object") return []
  const items = (value as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  return items.map((item) => String(item).trim()).filter(Boolean)
}

function parseOngoingAssessments(
  value: unknown
): OngoingAssessmentsJson | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<OngoingAssessmentsJson>
  return {
    phq9: Boolean(row.phq9),
    gad7: Boolean(row.gad7),
    assist: Boolean(row.assist),
  }
}

export async function loadActiveTreatmentPlanSummary(
  clientId: string,
  practiceId: string
) {
  const [row] = await db
    .select({
      treatmentPlanId: treatmentPlans.treatmentPlanId,
      versionNumber: treatmentPlans.versionNumber,
      startDate: treatmentPlans.startDate,
      therapeuticTarget: treatmentPlans.therapeuticTarget,
      behaviouralTargetsJson: treatmentPlans.behaviouralTargetsJson,
      ongoingAssessmentsJson: treatmentPlans.ongoingAssessmentsJson,
    })
    .from(treatmentPlans)
    .where(
      and(
        eq(treatmentPlans.clientId, clientId),
        eq(treatmentPlans.practiceId, practiceId),
        eq(treatmentPlans.isActive, true)
      )
    )
    .limit(1)

  if (!row) return null

  return {
    ...row,
    behaviouralTargetItems: parseBehaviouralTargetItems(
      row.behaviouralTargetsJson
    ),
    ongoingAssessmentsJson: parseOngoingAssessments(row.ongoingAssessmentsJson),
  }
}

export async function verifyClientInPractice(
  clientId: string,
  practiceId: string
) {
  const [client] = await db
    .select({
      clientId: clients.clientId,
      firstName: clients.firstName,
      lastName: clients.lastName,
      dateOfBirth: clients.dateOfBirth,
      email: clients.email,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  return client ?? null
}
