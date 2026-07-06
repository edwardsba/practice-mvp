"use server"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { crisisPlans } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildCrisisPlanPdfData } from "@/lib/crisis-plan/build-pdf-data"
import { generateAndStoreCrisisPlanPdf } from "@/lib/crisis-plan/generate-pdf"
import { buildCrisisPlanFilename } from "@/lib/crisis-plan/filename"
import { generateCrisisPlanPdf } from "@/lib/crisis-plan/pdf-document"
import { commitCrisisPlan } from "@/lib/crisis-plans/commit"
import {
  loadCrisisPlanForPractice,
  loadEmergencyContacts,
  verifyClientInPractice,
} from "@/lib/crisis-plans/load"
import {
  formValuesToDbColumns,
  parseCrisisPlanFormData,
} from "@/lib/crisis-plans/parse-form"
import type {
  CrisisPlanFormValues,
  CrisisPlanRow,
  EmergencyContactRow,
} from "@/lib/crisis-plans/types"
import { logDeleteAuditEvent, performSoftDelete } from "@/lib/delete/delete-utils"

export type CrisisPlanFormState = {
  error?: string
}

export type PreviewCrisisPlanState = {
  error?: string
  pdfBase64?: string
  valuesJson?: string
}

export async function previewCrisisPlan(
  clientId: string,
  sourcePlanId: string | null,
  _prevState: PreviewCrisisPlanState,
  formData: FormData
): Promise<PreviewCrisisPlanState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)

  if (!client) {
    return { error: "Client not found." }
  }

  let values: CrisisPlanFormValues
  try {
    values = parseCrisisPlanFormData(formData)
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Invalid crisis plan details.",
    }
  }

  const columns = formValuesToDbColumns(values)

  let nextVersion = 1
  if (sourcePlanId) {
    const sourcePlan = await loadCrisisPlanForPractice(
      sourcePlanId,
      clientId,
      context.practiceId
    )
    if (!sourcePlan) {
      return { error: "Crisis plan not found." }
    }
    nextVersion = sourcePlan.versionNumber + 1
  }

  const previewRow: CrisisPlanRow = {
    crisisPlanId: sourcePlanId ?? "preview",
    clientId,
    practiceId: context.practiceId,
    practitionerProfileId: context.practitionerProfileId,
    versionNumber: nextVersion,
    isActive: true,
    pdfStoragePath: null,
    ...columns,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const previewContacts: EmergencyContactRow[] = values.emergencyContacts.map(
    (contact) => ({
      contactId: contact.contactId ?? "preview",
      clientId,
      practiceId: context.practiceId,
      role: contact.role || null,
      name: contact.name,
      phone: contact.phone || null,
      email: contact.email || null,
      displayOrder: 0,
    })
  )

  const clientName = `${client.firstName} ${client.lastName}`
  const pdfData = buildCrisisPlanPdfData(previewRow, previewContacts, clientName)
  const buffer = await generateCrisisPlanPdf(pdfData)

  return {
    pdfBase64: buffer.toString("base64"),
    valuesJson: JSON.stringify(values),
  }
}

function parseValuesJson(formData: FormData): CrisisPlanFormValues {
  return JSON.parse(String(formData.get("values_json") ?? "{}")) as CrisisPlanFormValues
}

export type SaveCrisisPlanState = {
  error?: string
}

export async function saveCrisisPlan(
  clientId: string,
  sourcePlanId: string | null,
  _prevState: SaveCrisisPlanState,
  formData: FormData
): Promise<SaveCrisisPlanState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    return { error: "Client not found." }
  }

  let values: CrisisPlanFormValues
  try {
    values = parseValuesJson(formData)
  } catch {
    return { error: "Unable to save crisis plan. Please try again." }
  }

  let crisisPlanId: string
  try {
    const result = await commitCrisisPlan({
      clientId,
      practiceId: context.practiceId,
      practitionerProfileId: context.practitionerProfileId,
      userId: context.userId,
      sourcePlanId,
      values,
    })
    crisisPlanId = result.crisisPlanId
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to save crisis plan. Please try again.",
    }
  }

  revalidatePath(`/clients/${clientId}`)
  if (sourcePlanId) {
    revalidatePath(`/clients/${clientId}/crisis-plan/${sourcePlanId}`)
  }
  redirect(`/clients/${clientId}/crisis-plan/${crisisPlanId}`)
}

export type SaveCrisisPlanAndDownloadState = {
  error?: string
  success?: boolean
  newPlanId?: string
  pdfBase64?: string
  filename?: string
}

export async function saveCrisisPlanAndDownload(
  clientId: string,
  sourcePlanId: string | null,
  _prevState: SaveCrisisPlanAndDownloadState,
  formData: FormData
): Promise<SaveCrisisPlanAndDownloadState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    return { error: "Client not found." }
  }

  let values: CrisisPlanFormValues
  try {
    values = parseValuesJson(formData)
  } catch {
    return { error: "Unable to save crisis plan. Please try again." }
  }

  let crisisPlanId: string
  try {
    const result = await commitCrisisPlan({
      clientId,
      practiceId: context.practiceId,
      practitionerProfileId: context.practitionerProfileId,
      userId: context.userId,
      sourcePlanId,
      values,
    })
    crisisPlanId = result.crisisPlanId
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to save crisis plan. Please try again.",
    }
  }

  const plan = await loadCrisisPlanForPractice(crisisPlanId, clientId, context.practiceId)
  if (!plan) {
    return { error: "Crisis plan was saved, but could not be loaded for download." }
  }

  const contacts = await loadEmergencyContacts(clientId, context.practiceId)
  const clientName = `${client.firstName} ${client.lastName}`

  let pdfBuffer: Buffer
  try {
    const result = await generateAndStoreCrisisPlanPdf({
      plan,
      contacts,
      clientName,
    })
    pdfBuffer = result.pdfBuffer
  } catch {
    return {
      error:
        "Crisis plan was saved, but the PDF could not be generated. Use Download PDF on the plan to try again.",
    }
  }

  const filename = buildCrisisPlanFilename(
    plan.versionNumber,
    client.lastName,
    client.firstName
  )

  return {
    success: true,
    newPlanId: crisisPlanId,
    pdfBase64: pdfBuffer.toString("base64"),
    filename,
  }
}

export type SaveCrisisPlanAndSendState = {
  error?: string
  success?: boolean
  newPlanId?: string
}

export async function saveCrisisPlanAndSend(
  clientId: string,
  sourcePlanId: string | null,
  _prevState: SaveCrisisPlanAndSendState,
  formData: FormData
): Promise<SaveCrisisPlanAndSendState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    return { error: "Client not found." }
  }

  let values: CrisisPlanFormValues
  try {
    values = parseValuesJson(formData)
  } catch {
    return { error: "Unable to save crisis plan. Please try again." }
  }

  let crisisPlanId: string
  try {
    const result = await commitCrisisPlan({
      clientId,
      practiceId: context.practiceId,
      practitionerProfileId: context.practitionerProfileId,
      userId: context.userId,
      sourcePlanId,
      values,
    })
    crisisPlanId = result.crisisPlanId
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to save crisis plan. Please try again.",
    }
  }

  revalidatePath(`/clients/${clientId}`)
  if (sourcePlanId) {
    revalidatePath(`/clients/${clientId}/crisis-plan/${sourcePlanId}`)
  }
  redirect(`/clients/${clientId}/crisis-plan/${crisisPlanId}?openSend=1`)
}

export async function deleteCrisisPlan(
  crisisPlanId: string,
  practiceId: string
): Promise<{ success?: boolean; error?: string; blockedReason?: string }> {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    return { error: "Unauthorized practice access." }
  }

  const [plan] = await db
    .select({
      crisisPlanId: crisisPlans.crisisPlanId,
      clientId: crisisPlans.clientId,
    })
    .from(crisisPlans)
    .where(
      and(
        eq(crisisPlans.crisisPlanId, crisisPlanId),
        eq(crisisPlans.practiceId, practiceId),
        eq(crisisPlans.isActive, true)
      )
    )
    .limit(1)

  if (!plan) {
    return { error: "Crisis plan not found." }
  }

  const result = await performSoftDelete({
    table: crisisPlans,
    id: crisisPlanId,
    idField: crisisPlans.crisisPlanId,
    practiceId,
    practiceIdField: crisisPlans.practiceId,
  })

  if (!result.success) {
    return { error: result.error ?? "Unable to delete crisis plan." }
  }

  await logDeleteAuditEvent({
    practiceId,
    userId: context.userId,
    clientId: plan.clientId,
    eventType: "crisis_plan.deleted",
    entityType: "crisis_plan",
    entityId: crisisPlanId,
  })

  revalidatePath(`/clients/${plan.clientId}`)
  revalidatePath(`/clients/${plan.clientId}/crisis-plan`)
  redirect(`/clients/${plan.clientId}/crisis-plan`)
}
