import { and, eq } from "drizzle-orm"

import {
  assessmentAccessLinks,
  batteryInstances,
} from "@/db/schema"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { db } from "@/lib/db"

export function isAccessLinkSubmittable(accessStatus: string, expiresAt: Date) {
  return accessStatus === "active" && expiresAt.getTime() > Date.now()
}

export async function validateBatteryNextToken(
  phq9AccessLinkId: string,
  clientId: string,
  practiceId: string,
  nextRawToken: string
): Promise<boolean> {
  const nextHash = hashAssessmentToken(nextRawToken)

  const [gad7Link] = await db
    .select({
      assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
      clientId: assessmentAccessLinks.clientId,
      practiceId: assessmentAccessLinks.practiceId,
      accessStatus: assessmentAccessLinks.accessStatus,
      expiresAt: assessmentAccessLinks.expiresAt,
    })
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.tokenHash, nextHash))
    .limit(1)

  if (
    !gad7Link ||
    gad7Link.clientId !== clientId ||
    gad7Link.practiceId !== practiceId ||
    gad7Link.accessStatus === "submitted" ||
    !isAccessLinkSubmittable(gad7Link.accessStatus, gad7Link.expiresAt)
  ) {
    return false
  }

  const [battery] = await db
    .select({ batteryInstanceId: batteryInstances.batteryInstanceId })
    .from(batteryInstances)
    .where(
      and(
        eq(batteryInstances.phq9LinkId, phq9AccessLinkId),
        eq(batteryInstances.gad7LinkId, gad7Link.assessmentAccessLinkId),
        eq(batteryInstances.clientId, clientId),
        eq(batteryInstances.practiceId, practiceId)
      )
    )
    .limit(1)

  return Boolean(battery)
}

export async function completeBatteryIfLastLink(
  accessLinkId: string,
  clientId: string,
  practiceId: string
): Promise<boolean> {
  const [battery] = await db
    .select({ batteryInstanceId: batteryInstances.batteryInstanceId })
    .from(batteryInstances)
    .where(
      and(
        eq(batteryInstances.lastLinkId, accessLinkId),
        eq(batteryInstances.clientId, clientId),
        eq(batteryInstances.practiceId, practiceId)
      )
    )
    .limit(1)

  if (!battery) {
    return false
  }

  await db
    .update(batteryInstances)
    .set({ status: "submitted", updatedAt: new Date() })
    .where(eq(batteryInstances.batteryInstanceId, battery.batteryInstanceId))

  return true
}

export async function markBatteryInProgress(firstAccessLinkId: string) {
  await db
    .update(batteryInstances)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(batteryInstances.firstLinkId, firstAccessLinkId))
}
