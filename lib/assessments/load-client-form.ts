import { eq } from "drizzle-orm"

import {
  assessmentAccessLinks,
  assessmentDefinitions,
  assessmentInstances,
  auditEvents,
  practices,
} from "@/db/schema"
import { loadFormDefinitionByCode } from "@/lib/assessments/load-form-definition"
import { definitionUsesSharedClientForm } from "@/lib/assessments/needs-shared-client-form"
import { hashAssessmentToken } from "@/lib/assessments/token"
import type { FormElement } from "@/lib/assessments/form-rules"
import { db } from "@/lib/db"

export type ClientFormQuestionnaire = {
  practiceName: string
  assessmentName: string
  introText: string
  assessmentCode: string
  clientId: string
  instanceId: string
  elements: FormElement[]
}

function isLinkUsable(
  accessStatus: string,
  expiresAt: Date,
  allowSubmitted = false
) {
  if (expiresAt.getTime() <= Date.now()) {
    return false
  }
  if (accessStatus === "active") {
    return true
  }
  return allowSubmitted && accessStatus === "submitted"
}

function clientFormIntro(assessmentCode: string): string {
  if (assessmentCode === "BACKGROUND_SR") {
    return "Please tell us a bit about yourself. Nothing is required — you can skip any question, and for anything sensitive you can choose \"I'd rather talk about it in person\"."
  }
  return "Please answer the following questions as honestly as you can."
}

/**
 * Load the shared form definition for a client access link.
 * Same link checks as loadQuestionnaireForToken (active / not expired / opened_at).
 * Returns ok:false when the link is unusable or the definition is radio-only
 * (those stay on the legacy questionnaire path).
 */
export async function loadClientFormForToken(
  rawToken: string,
  loadOptions?: { allowSubmitted?: boolean }
): Promise<{ ok: true; data: ClientFormQuestionnaire } | { ok: false }> {
  const tokenHash = hashAssessmentToken(rawToken)

  const [accessLink] = await db
    .select()
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.tokenHash, tokenHash))
    .limit(1)

  if (
    !accessLink ||
    !isLinkUsable(
      accessLink.accessStatus,
      accessLink.expiresAt,
      loadOptions?.allowSubmitted
    )
  ) {
    return { ok: false }
  }

  if (!accessLink.openedAt) {
    await db.transaction(async (tx) => {
      await tx
        .update(assessmentAccessLinks)
        .set({
          openedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          eq(
            assessmentAccessLinks.assessmentAccessLinkId,
            accessLink.assessmentAccessLinkId
          )
        )

      await tx.insert(auditEvents).values({
        practiceId: accessLink.practiceId,
        clientId: accessLink.clientId,
        eventType: "assessment_link.opened",
        entityType: "assessment_access_link",
        entityId: accessLink.assessmentAccessLinkId,
      })
    })
  }

  const [instance] = await db
    .select({
      assessmentInstanceId: assessmentInstances.assessmentInstanceId,
      assessmentDefinitionId: assessmentInstances.assessmentDefinitionId,
      clientId: assessmentInstances.clientId,
    })
    .from(assessmentInstances)
    .where(
      eq(assessmentInstances.assessmentInstanceId, accessLink.assessmentInstanceId)
    )
    .limit(1)

  if (!instance) {
    return { ok: false }
  }

  const [definitionMeta] = await db
    .select({
      assessmentCode: assessmentDefinitions.assessmentCode,
      assessmentName: assessmentDefinitions.assessmentName,
      clientDisplayName: assessmentDefinitions.clientDisplayName,
    })
    .from(assessmentDefinitions)
    .where(
      eq(
        assessmentDefinitions.assessmentDefinitionId,
        instance.assessmentDefinitionId
      )
    )
    .limit(1)

  if (!definitionMeta) {
    return { ok: false }
  }

  const loaded = await loadFormDefinitionByCode(definitionMeta.assessmentCode)
  if (!loaded || !definitionUsesSharedClientForm(loaded.elements)) {
    return { ok: false }
  }

  const [practice] = await db
    .select({ practiceName: practices.practiceName })
    .from(practices)
    .where(eq(practices.practiceId, accessLink.practiceId))
    .limit(1)

  if (!practice) {
    return { ok: false }
  }

  return {
    ok: true,
    data: {
      practiceName: practice.practiceName,
      assessmentName:
        definitionMeta.clientDisplayName || definitionMeta.assessmentName,
      introText: clientFormIntro(definitionMeta.assessmentCode),
      assessmentCode: definitionMeta.assessmentCode,
      clientId: instance.clientId,
      instanceId: instance.assessmentInstanceId,
      elements: loaded.elements,
    },
  }
}

/**
 * Whether the assessment code should use the shared client form (not the legacy
 * radio questionnaire). Uses the live definition when available.
 */
export async function assessmentUsesSharedClientForm(
  assessmentCode: string
): Promise<boolean> {
  const loaded = await loadFormDefinitionByCode(assessmentCode)
  if (!loaded) return false
  return definitionUsesSharedClientForm(loaded.elements)
}
