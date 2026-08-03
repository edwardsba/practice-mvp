import { randomBytes } from "crypto"
import { and, eq } from "drizzle-orm"

import {
  assessmentAccessLinks,
  assessmentDefinitions,
  assessmentInstances,
  auditEvents,
  clients,
} from "@/db/schema"
import {
  batteryInstanceModules,
  diagnosticBatteryInstances,
} from "@/db/schema/17-diagnostic-battery"
import { hashAssessmentToken } from "@/lib/assessments/token"
import { db } from "@/lib/db"
import { buildTemplateVariablesFromLinkResponse } from "@/lib/email/link-response"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"

const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Fixed Tier 1 baseline — every diagnostic battery starts with these four, in this order.
// PID5_FBF is last: it has no urgent-flag mechanism and no timeframe dependency, so the
// safety-relevant/shorter instruments come first and the 100-item form comes last once the
// client's already committed. Everything past this point (Tier 2/3) is adaptive and gets
// appended reactively by appendTriggeredModule as results come in, not created here.
const TIER_1_BASELINE_CODES = ["LEVEL1_XC", "PC_PTSD5", "ASRS_PART_A", "PID5_FBF"] as const

export type CreateDiagnosticBatteryInstanceParams = {
  clientId: string
  practiceId: string
  practitionerProfileId: string
  batteryCode?: "DIAGNOSTIC_INTAKE" | "DIAGNOSTIC_ANNUAL"
  userId?: string | null
}

export type CreateDiagnosticBatteryInstanceResult =
  | {
      ok: true
      link: string
      expiresAt: Date
      diagnosticBatteryInstanceId: string
      firstAccessLinkId: string
      clientEmail: string | null
      templateVariables: ReturnType<typeof buildTemplateVariablesFromLinkResponse>
    }
  | { ok: false; error: string }

export async function createDiagnosticBatteryInstance(
  params: CreateDiagnosticBatteryInstanceParams
): Promise<CreateDiagnosticBatteryInstanceResult> {
  const clientId = params.clientId.trim()
  const practiceId = params.practiceId.trim()
  const practitionerProfileId = params.practitionerProfileId.trim()
  const batteryCode = params.batteryCode ?? "DIAGNOSTIC_INTAKE"

  if (!clientId || !practitionerProfileId) {
    return { ok: false, error: "client_id and practitioner_profile_id are required." }
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
    definitions.map((row) => [row.assessmentCode, row])
  )

  for (const code of TIER_1_BASELINE_CODES) {
    if (!definitionByCode.has(code)) {
      return { ok: false, error: `${code} assessment definition is not available.` }
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (!appUrl) {
    return { ok: false, error: "Application URL is not configured." }
  }

  const expiresAt = new Date(Date.now() + LINK_TTL_MS)
  const chain = TIER_1_BASELINE_CODES.map((code) => ({
    code,
    rawToken: randomBytes(32).toString("hex"),
    tokenHash: "",
    instanceId: "",
    accessLinkId: "",
  }))

  for (const item of chain) {
    item.tokenHash = hashAssessmentToken(item.rawToken)
  }

  let diagnosticBatteryInstanceId: string

  try {
    await db.transaction(async (tx) => {
      const [batteryRow] = await tx
        .insert(diagnosticBatteryInstances)
        .values({
          practiceId,
          clientId,
          practitionerProfileId,
          batteryCode,
          status: "assigned",
        })
        .returning({
          diagnosticBatteryInstanceId:
            diagnosticBatteryInstances.diagnosticBatteryInstanceId,
        })

      diagnosticBatteryInstanceId = batteryRow.diagnosticBatteryInstanceId

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

        await tx.insert(batteryInstanceModules).values({
          diagnosticBatteryInstanceId,
          assessmentInstanceId: item.instanceId,
          assessmentAccessLinkId: item.accessLinkId,
          assessmentCode: item.code,
          tier: "tier_1",
          moduleOrder: index + 1,
          triggeredByModuleId: null,
        })
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
          .where(eq(assessmentAccessLinks.assessmentAccessLinkId, item.accessLinkId))
      }

      const firstItem = chain[0]
      const lastItem = chain[chain.length - 1]

      await tx
        .update(diagnosticBatteryInstances)
        .set({
          firstLinkId: firstItem.accessLinkId,
          lastLinkId: lastItem.accessLinkId,
          updatedAt: new Date(),
        })
        .where(
          eq(
            diagnosticBatteryInstances.diagnosticBatteryInstanceId,
            diagnosticBatteryInstanceId
          )
        )

      await tx.insert(auditEvents).values({
        practiceId,
        userId: params.userId ?? null,
        clientId,
        eventType: "diagnostic_battery.created",
        entityType: "diagnostic_battery_instance",
        entityId: diagnosticBatteryInstanceId,
      })
    })
  } catch {
    return {
      ok: false,
      error: "Unable to create diagnostic assessment battery. Please try again.",
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
    diagnosticBatteryInstanceId: diagnosticBatteryInstanceId!,
    firstAccessLinkId: first.accessLinkId,
    clientEmail: client.email?.trim() || null,
    templateVariables: buildTemplateVariablesFromLinkResponse({
      clientFirstName: client.firstName,
      practiceName: emailContext.practiceName,
      practitionerName: emailContext.practitionerName,
      expiresAt,
    }),
  }
}
