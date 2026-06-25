import { and, eq } from "drizzle-orm"

import { assessmentAccessLinks } from "@/db/schema"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { db } from "@/lib/db"

export function isAccessLinkSubmittable(accessStatus: string, expiresAt: Date) {
  return accessStatus === "active" && expiresAt.getTime() > Date.now()
}

export async function validateBatteryNextToken(
  currentAccessLinkId: string,
  clientId: string,
  practiceId: string,
  nextRawToken: string,
  options?: { allowSubmittedNext?: boolean }
): Promise<boolean> {
  const [currentLink] = await db
    .select({
      nextAccessLinkId: assessmentAccessLinks.nextAccessLinkId,
      nextRawToken: assessmentAccessLinks.nextRawToken,
    })
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.assessmentAccessLinkId, currentAccessLinkId))
    .limit(1)

  if (!currentLink?.nextAccessLinkId || currentLink.nextRawToken !== nextRawToken) {
    return false
  }

  const nextHash = hashAssessmentToken(nextRawToken)

  const [nextLink] = await db
    .select({
      assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
      clientId: assessmentAccessLinks.clientId,
      practiceId: assessmentAccessLinks.practiceId,
      accessStatus: assessmentAccessLinks.accessStatus,
      expiresAt: assessmentAccessLinks.expiresAt,
    })
    .from(assessmentAccessLinks)
    .where(
      and(
        eq(assessmentAccessLinks.tokenHash, nextHash),
        eq(
          assessmentAccessLinks.assessmentAccessLinkId,
          currentLink.nextAccessLinkId
        )
      )
    )
    .limit(1)

  if (
    !nextLink ||
    nextLink.clientId !== clientId ||
    nextLink.practiceId !== practiceId ||
    nextLink.expiresAt.getTime() <= Date.now()
  ) {
    return false
  }

  if (options?.allowSubmittedNext) {
    return (
      nextLink.accessStatus === "active" || nextLink.accessStatus === "submitted"
    )
  }

  if (
    nextLink.accessStatus === "submitted" ||
    !isAccessLinkSubmittable(nextLink.accessStatus, nextLink.expiresAt)
  ) {
    return false
  }

  return true
}

export async function getPreviousLinkRawToken(
  accessLinkId: string
): Promise<string | null> {
  const [previous] = await db
    .select({ nextRawToken: assessmentAccessLinks.nextRawToken })
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.nextAccessLinkId, accessLinkId))
    .limit(1)

  return previous?.nextRawToken ?? null
}

export async function buildNextQuestionnaireUrl(
  currentAccessLinkId: string
): Promise<string | null> {
  const [currentLink] = await db
    .select({
      nextRawToken: assessmentAccessLinks.nextRawToken,
      nextAccessLinkId: assessmentAccessLinks.nextAccessLinkId,
    })
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.assessmentAccessLinkId, currentAccessLinkId))
    .limit(1)

  if (!currentLink?.nextRawToken || !currentLink.nextAccessLinkId) {
    return null
  }

  const [nextLink] = await db
    .select({ nextRawToken: assessmentAccessLinks.nextRawToken })
    .from(assessmentAccessLinks)
    .where(
      eq(assessmentAccessLinks.assessmentAccessLinkId, currentLink.nextAccessLinkId)
    )
    .limit(1)

  const base = `/q/${currentLink.nextRawToken}`
  if (nextLink?.nextRawToken) {
    return `${base}?battery=${encodeURIComponent(nextLink.nextRawToken)}`
  }

  return base
}

export async function isLastInBatteryChain(
  accessLinkId: string
): Promise<boolean> {
  const [link] = await db
    .select({ nextAccessLinkId: assessmentAccessLinks.nextAccessLinkId })
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.assessmentAccessLinkId, accessLinkId))
    .limit(1)

  if (link?.nextAccessLinkId) {
    return false
  }

  const [previous] = await db
    .select({ assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId })
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.nextAccessLinkId, accessLinkId))
    .limit(1)

  return Boolean(previous)
}

export async function markBatteryInProgress(firstAccessLinkId: string) {
  const { batteryInstances } = await import("@/db/schema")

  await db
    .update(batteryInstances)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(batteryInstances.firstLinkId, firstAccessLinkId))
}

export async function completeBatteryIfLastLink(
  accessLinkId: string,
  clientId: string,
  practiceId: string
): Promise<boolean> {
  const { completeBatteryIfLastLink: completeBattery } =
    await import("@/lib/assessments/battery")
  return completeBattery(accessLinkId, clientId, practiceId)
}
