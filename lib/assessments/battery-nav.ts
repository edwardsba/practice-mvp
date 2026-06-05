import { eq } from "drizzle-orm"

import { assessmentAccessLinks } from "@/db/schema"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { db } from "@/lib/db"

export type BatteryNavContext = {
  hasPrevious: boolean
  isFirstInBattery: boolean
  isLastInBattery: boolean
  isBatteryStep: boolean
}

export async function loadBatteryNavContext(
  rawToken: string,
  batteryNextToken?: string
): Promise<BatteryNavContext> {
  const tokenHash = hashAssessmentToken(rawToken)

  const [accessLink] = await db
    .select({
      assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
      nextRawToken: assessmentAccessLinks.nextRawToken,
    })
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.tokenHash, tokenHash))
    .limit(1)

  if (!accessLink) {
    return {
      hasPrevious: false,
      isFirstInBattery: true,
      isLastInBattery: true,
      isBatteryStep: false,
    }
  }

  const [previousLink] = await db
    .select({
      assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
    })
    .from(assessmentAccessLinks)
    .where(
      eq(
        assessmentAccessLinks.nextAccessLinkId,
        accessLink.assessmentAccessLinkId
      )
    )
    .limit(1)

  const hasPrevious = Boolean(previousLink)
  const isBatteryStep = Boolean(
    hasPrevious || batteryNextToken || accessLink.nextRawToken
  )
  const isFirstInBattery = !hasPrevious
  const isLastInBattery = !batteryNextToken

  return {
    hasPrevious,
    isFirstInBattery,
    isLastInBattery,
    isBatteryStep,
  }
}
