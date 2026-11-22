"use server"

import { revalidatePath } from "next/cache"

import { requirePractitionerContext } from "@/lib/auth"
import {
  deleteMedicalContact,
  ensureMedicalContact,
  updateMedicalContact,
} from "@/lib/medical-contacts/mutations"

export type MedicalContactFormState = {
  error?: string
  success?: boolean
  medicalContactId?: string
}

function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/edit`)
  revalidatePath(`/clients/${clientId}/background`)
  revalidatePath(`/clients/${clientId}/background/interview`)
}

export async function addMedicalContactAction(
  clientId: string,
  _prev: MedicalContactFormState,
  formData: FormData
): Promise<MedicalContactFormState> {
  const context = await requirePractitionerContext()
  const professionalId = String(formData.get("professional_id") ?? "").trim()
  const notes = String(formData.get("notes") ?? "").trim() || null
  const isMain = formData.get("is_main") === "on"

  if (!professionalId) {
    return { error: "Choose a professional." }
  }

  const result = await ensureMedicalContact({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    professionalId,
    isMain,
    notes,
  })
  if (result.error) return { error: result.error }

  refresh(clientId)
  return { success: true, medicalContactId: result.medicalContactId }
}

export async function updateMedicalContactAction(
  clientId: string,
  medicalContactId: string,
  _prev: MedicalContactFormState,
  formData: FormData
): Promise<MedicalContactFormState> {
  const context = await requirePractitionerContext()
  const notes = String(formData.get("notes") ?? "").trim() || null
  const isMain = formData.get("is_main") === "on"

  const result = await updateMedicalContact({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    medicalContactId,
    isMain,
    notes,
  })
  if (result.error) return { error: result.error }

  refresh(clientId)
  return { success: true, medicalContactId }
}

export async function deleteMedicalContactAction(
  clientId: string,
  medicalContactId: string
): Promise<MedicalContactFormState> {
  const context = await requirePractitionerContext()
  const result = await deleteMedicalContact({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    medicalContactId,
  })
  if (result.error) return { error: result.error }

  refresh(clientId)
  return { success: true }
}

/** Add a professional to the medical contacts list (used from History medication form). */
export async function ensureMedicalContactAction(
  clientId: string,
  professionalId: string
): Promise<MedicalContactFormState> {
  const context = await requirePractitionerContext()
  const result = await ensureMedicalContact({
    clientId,
    practiceId: context.practiceId,
    userId: context.userId,
    professionalId,
  })
  if (result.error) return { error: result.error }
  refresh(clientId)
  return { success: true, medicalContactId: result.medicalContactId }
}
