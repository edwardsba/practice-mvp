"use server"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { treatmentPlans } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { commitTreatmentPlan } from "@/lib/treatment-plans/commit"
import { buildTreatmentPlanFilename } from "@/lib/treatment-plans/filename"
import { generateTreatmentPlanPdf } from "@/lib/treatment-plans/generate-pdf"
import {
  loadTreatmentPlanForPractice,
  verifyClientInPractice,
} from "@/lib/treatment-plans/load"
import {
  formValuesToDbColumns,
  parseTreatmentPlanFormData,
} from "@/lib/treatment-plans/parse-form"
import type { TreatmentPlanFormValues, TreatmentPlanRow } from "@/lib/treatment-plans/types"
import { uploadTreatmentPlanPdf } from "@/lib/treatment-plans/upload-pdf"
import { logDeleteAuditEvent, performSoftDelete } from "@/lib/delete/delete-utils"

export type TreatmentPlanFormState = {
  error?: string
}

export type PreviewTreatmentPlanState = {
  error?: string
  pdfBase64?: string
  valuesJson?: string
}

export async function previewTreatmentPlan(
  clientId: string,
  sourcePlanId: string | null,
  _prevState: PreviewTreatmentPlanState,
  formData: FormData
): Promise<PreviewTreatmentPlanState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)

  if (!client) {
    return { error: "Client not found." }
  }

  const values = parseTreatmentPlanFormData(formData)
  const columns = formValuesToDbColumns(values)

  let nextVersion = 1
  if (sourcePlanId) {
    const sourcePlan = await loadTreatmentPlanForPractice(
      sourcePlanId,
      clientId,
      context.practiceId
    )
    if (!sourcePlan) {
      return { error: "Treatment plan not found." }
    }
    nextVersion = sourcePlan.versionNumber + 1
  }

  const previewRow: TreatmentPlanRow = {
    treatmentPlanId: sourcePlanId ?? "preview",
    clientId,
    practiceId: context.practiceId,
    practitionerProfileId: context.practitionerProfileId,
    versionNumber: nextVersion,
    isActive: true,
    ...columns,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const buffer = await generateTreatmentPlanPdf(previewRow, client)

  return {
    pdfBase64: buffer.toString("base64"),
    valuesJson: JSON.stringify(values),
  }
}

function parseValuesJson(formData: FormData): TreatmentPlanFormValues {
  return JSON.parse(String(formData.get("values_json") ?? "{}")) as TreatmentPlanFormValues
}

export type SaveTreatmentPlanState = {
  error?: string
}

export async function saveTreatmentPlan(
  clientId: string,
  sourcePlanId: string | null,
  _prevState: SaveTreatmentPlanState,
  formData: FormData
): Promise<SaveTreatmentPlanState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    return { error: "Client not found." }
  }

  let values: TreatmentPlanFormValues
  try {
    values = parseValuesJson(formData)
  } catch {
    return { error: "Unable to save treatment plan. Please try again." }
  }

  let treatmentPlanId: string
  try {
    const result = await commitTreatmentPlan({
      clientId,
      practiceId: context.practiceId,
      practitionerProfileId: context.practitionerProfileId,
      userId: context.userId,
      sourcePlanId,
      values,
    })
    treatmentPlanId = result.treatmentPlanId
  } catch {
    return { error: "Unable to save treatment plan. Please try again." }
  }

  revalidatePath(`/clients/${clientId}`)
  if (sourcePlanId) {
    revalidatePath(`/clients/${clientId}/treatment-plan/${sourcePlanId}`)
  }
  redirect(`/clients/${clientId}/treatment-plan/${treatmentPlanId}`)
}

export type SaveTreatmentPlanAndDownloadState = {
  error?: string
  success?: boolean
  newPlanId?: string
  pdfBase64?: string
  filename?: string
}

export async function saveTreatmentPlanAndDownload(
  clientId: string,
  sourcePlanId: string | null,
  _prevState: SaveTreatmentPlanAndDownloadState,
  formData: FormData
): Promise<SaveTreatmentPlanAndDownloadState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    return { error: "Client not found." }
  }

  let values: TreatmentPlanFormValues
  try {
    values = parseValuesJson(formData)
  } catch {
    return { error: "Unable to save treatment plan. Please try again." }
  }

  let treatmentPlanId: string
  try {
    const result = await commitTreatmentPlan({
      clientId,
      practiceId: context.practiceId,
      practitionerProfileId: context.practitionerProfileId,
      userId: context.userId,
      sourcePlanId,
      values,
    })
    treatmentPlanId = result.treatmentPlanId
  } catch {
    return { error: "Unable to save treatment plan. Please try again." }
  }

  const plan = await loadTreatmentPlanForPractice(
    treatmentPlanId,
    clientId,
    context.practiceId
  )
  if (!plan) {
    return {
      error: "Treatment plan was saved, but could not be loaded for download.",
    }
  }

  const uploadResult = await uploadTreatmentPlanPdf(plan, client, context.practiceId)
  if (!uploadResult.ok) {
    return {
      error:
        "Treatment plan was saved, but the PDF could not be generated. Use Download PDF on the plan to try again.",
    }
  }

  const buffer = await generateTreatmentPlanPdf(plan, client)
  const filename = buildTreatmentPlanFilename(
    plan.versionNumber,
    client.lastName,
    client.firstName
  )

  revalidatePath(`/clients/${clientId}`)
  if (sourcePlanId) {
    revalidatePath(`/clients/${clientId}/treatment-plan/${sourcePlanId}`)
  }
  revalidatePath(`/clients/${clientId}/treatment-plan/${treatmentPlanId}`)

  return {
    success: true,
    newPlanId: treatmentPlanId,
    pdfBase64: buffer.toString("base64"),
    filename,
  }
}

export type SaveTreatmentPlanAndSendState = {
  error?: string
  success?: boolean
  newPlanId?: string
}

export async function saveTreatmentPlanAndSend(
  clientId: string,
  sourcePlanId: string | null,
  _prevState: SaveTreatmentPlanAndSendState,
  formData: FormData
): Promise<SaveTreatmentPlanAndSendState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    return { error: "Client not found." }
  }

  let values: TreatmentPlanFormValues
  try {
    values = parseValuesJson(formData)
  } catch {
    return { error: "Unable to save treatment plan. Please try again." }
  }

  let treatmentPlanId: string
  try {
    const result = await commitTreatmentPlan({
      clientId,
      practiceId: context.practiceId,
      practitionerProfileId: context.practitionerProfileId,
      userId: context.userId,
      sourcePlanId,
      values,
    })
    treatmentPlanId = result.treatmentPlanId
  } catch {
    return { error: "Unable to save treatment plan. Please try again." }
  }

  revalidatePath(`/clients/${clientId}`)
  if (sourcePlanId) {
    revalidatePath(`/clients/${clientId}/treatment-plan/${sourcePlanId}`)
  }
  revalidatePath(`/clients/${clientId}/treatment-plan/${treatmentPlanId}`)

  return { success: true, newPlanId: treatmentPlanId }
}

export async function deleteTreatmentPlan(
  treatmentPlanId: string,
  practiceId: string
): Promise<{ success?: boolean; error?: string; blockedReason?: string }> {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    return { error: "Unauthorized practice access." }
  }

  const [plan] = await db
    .select({
      treatmentPlanId: treatmentPlans.treatmentPlanId,
      clientId: treatmentPlans.clientId,
    })
    .from(treatmentPlans)
    .where(
      and(
        eq(treatmentPlans.treatmentPlanId, treatmentPlanId),
        eq(treatmentPlans.practiceId, practiceId),
        eq(treatmentPlans.isActive, true)
      )
    )
    .limit(1)

  if (!plan) {
    return { error: "Treatment plan not found." }
  }

  const result = await performSoftDelete({
    table: treatmentPlans,
    id: treatmentPlanId,
    idField: treatmentPlans.treatmentPlanId,
    practiceId,
    practiceIdField: treatmentPlans.practiceId,
  })

  if (!result.success) {
    return { error: result.error ?? "Unable to delete treatment plan." }
  }

  await logDeleteAuditEvent({
    practiceId,
    userId: context.userId,
    clientId: plan.clientId,
    eventType: "treatment_plan.deleted",
    entityType: "treatment_plan",
    entityId: treatmentPlanId,
  })

  revalidatePath(`/clients/${plan.clientId}`)
  revalidatePath(`/clients/${plan.clientId}/treatment-plan`)
  redirect(`/clients/${plan.clientId}/treatment-plan`)
}
