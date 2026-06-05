import { randomBytes } from "crypto"
import { and, eq } from "drizzle-orm"

import {
  assessmentAccessLinks,
  assessmentDefinitions,
  assessmentInstances,
  auditEvents,
  batteryInstances,
  clients,
} from "@/db/schema"
import {
  isBatteryAssessmentCode,
  normalizeBatteryCodes,
  type BatteryAssessmentCode,
} from "@/lib/assessments/battery-codes"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { db } from "@/lib/db"
import { buildTemplateVariablesFromLinkResponse } from "@/lib/email/link-response"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"

const BATTERY_CODE = "PRE_SESSION"
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type CreateBatteryInstanceParams = {
  clientId: string
  practiceId: string
  practitionerProfileId: string
  assessmentCodes: string[]
  userId?: string | null
}

export type CreateBatteryInstanceResult =
  | {
      ok: true
      link: string
      expiresAt: Date
      assessmentAccessLinkId: string
      clientEmail: string | null
      templateVariables: ReturnType<typeof buildTemplateVariablesFromLinkResponse>
    }
  | { ok: false; error: string }

export async function createBatteryInstance(
  params: CreateBatteryInstanceParams
): Promise<CreateBatteryInstanceResult> {
  const clientId = params.clientId.trim()
  const practiceId = params.practiceId.trim()
  const practitionerProfileId = params.practitionerProfileId.trim()
  const requestedCodes = normalizeBatteryCodes(params.assessmentCodes)

  if (!clientId || !practitionerProfileId) {
    return { ok: false, error: "client_id and practitioner_profile_id are required." }
  }

  if (requestedCodes.length === 0) {
    return { ok: false, error: "At least one valid assessment code is required." }
  }

  const [client] = await db
    .select({
      clientId: clients.clientId,
      email: clients.email,
      firstName: clients.firstName,
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

  if (!client) {
    return { ok: false, error: "Client not found." }
  }

  const emailContext = await getQuestionnaireEmailContext(
    practiceId,
    practitionerProfileId
  )
  if (!emailContext) {
    return { ok: false, error: "Practice or practitioner not found." }
  }

  const definitions = await db
    .select({
      assessmentDefinitionId: assessmentDefinitions.assessmentDefinitionId,
      assessmentCode: assessmentDefinitions.assessmentCode,
    })
    .from(assessmentDefinitions)
    .where(eq(assessmentDefinitions.isActive, true))

  const definitionByCode = new Map(
    definitions
      .filter((row) => isBatteryAssessmentCode(row.assessmentCode))
      .map((row) => [row.assessmentCode as BatteryAssessmentCode, row])
  )

  for (const code of requestedCodes) {
    if (!definitionByCode.has(code)) {
      return { ok: false, error: `${code} assessment definition is not available.` }
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (!appUrl) {
    return { ok: false, error: "Application URL is not configured." }
  }

  const expiresAt = new Date(Date.now() + LINK_TTL_MS)
  const chain = requestedCodes.map((code) => ({
    code,
    rawToken: randomBytes(32).toString("hex"),
    tokenHash: "",
    instanceId: "",
    accessLinkId: "",
  }))

  for (const item of chain) {
    item.tokenHash = hashAssessmentToken(item.rawToken)
  }

  let firstAccessLinkId: string

  try {
    await db.transaction(async (tx) => {
      for (let index = 0; index < chain.length; index++) {
        const item = chain[index]
        const definition = definitionByCode.get(item.code)!

        const [instance] = await tx
          .insert(assessmentInstances)
          .values({
            assessmentDefinitionId: definition.assessmentDefinitionId,
            clientId,
            practiceId,
            practitionerProfileId,
            status: "assigned",
          })
          .returning({
            assessmentInstanceId: assessmentInstances.assessmentInstanceId,
          })

        item.instanceId = instance.assessmentInstanceId

        const [link] = await tx
          .insert(assessmentAccessLinks)
          .values({
            assessmentInstanceId: instance.assessmentInstanceId,
            practiceId,
            clientId,
            tokenHash: item.tokenHash,
            expiresAt,
            accessStatus: "active",
          })
          .returning({
            assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
          })

        item.accessLinkId = link.assessmentAccessLinkId
      }

      for (let index = 0; index < chain.length - 1; index++) {
        const item = chain[index]
        const nextItem = chain[index + 1]
        await tx
          .update(assessmentAccessLinks)
          .set({
            nextAccessLinkId: nextItem.accessLinkId,
            nextRawToken: nextItem.rawToken,
            updatedAt: new Date(),
          })
          .where(
            eq(
              assessmentAccessLinks.assessmentAccessLinkId,
              item.accessLinkId
            )
          )
      }

      firstAccessLinkId = chain[0].accessLinkId

      const phq9 = chain.find((item) => item.code === "PHQ9")
      const gad7 = chain.find((item) => item.code === "GAD7")

      if (phq9 && gad7) {
        const [battery] = await tx
          .insert(batteryInstances)
          .values({
            practiceId,
            clientId,
            practitionerProfileId,
            batteryCode: BATTERY_CODE,
            phq9InstanceId: phq9.instanceId,
            gad7InstanceId: gad7.instanceId,
            phq9LinkId: phq9.accessLinkId,
            gad7LinkId: gad7.accessLinkId,
            status: "assigned",
          })
          .returning({ batteryInstanceId: batteryInstances.batteryInstanceId })

        await tx.insert(auditEvents).values({
          practiceId,
          userId: params.userId ?? null,
          clientId,
          eventType: "battery.created",
          entityType: "battery_instance",
          entityId: battery.batteryInstanceId,
        })
      } else {
        await tx.insert(auditEvents).values({
          practiceId,
          userId: params.userId ?? null,
          clientId,
          eventType: "battery.created",
          entityType: "assessment_access_link",
          entityId: firstAccessLinkId!,
        })
      }
    })
  } catch {
    return {
      ok: false,
      error: "Unable to create pre-session questionnaire link. Please try again.",
    }
  }

  const first = chain[0]
  const second = chain[1]
  const linkUrl = second
    ? `${appUrl}/q/${first.rawToken}?battery=${encodeURIComponent(second.rawToken)}`
    : `${appUrl}/q/${first.rawToken}`

  return {
    ok: true,
    link: linkUrl,
    expiresAt,
    assessmentAccessLinkId: firstAccessLinkId!,
    clientEmail: client.email?.trim() || null,
    templateVariables: buildTemplateVariablesFromLinkResponse({
      clientFirstName: client.firstName,
      practiceName: emailContext.practiceName,
      practitionerName: emailContext.practitionerName,
      expiresAt,
    }),
  }
}
