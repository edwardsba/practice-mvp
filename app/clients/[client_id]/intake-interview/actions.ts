"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { requirePractitionerContext } from "@/lib/auth"
import {
  commitIntakeInterview,
  createIntakeInterviewVersion,
} from "@/lib/intake-interview/commit"
import {
  loadCurrentIntakeInterview,
  loadIntakeInterviewForPractice,
  verifyClientInPractice,
} from "@/lib/intake-interview/load"
import { parseIntakeInterviewFormData } from "@/lib/intake-interview/parse-form"

export type SaveIntakeInterviewState = {
  error?: string
}

export async function saveIntakeInterview(
  clientId: string,
  sourceInterviewId: string | null,
  _prevState: SaveIntakeInterviewState,
  formData: FormData
): Promise<SaveIntakeInterviewState> {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    return { error: "Client not found." }
  }

  const intent = String(formData.get("intent") ?? "draft")
  const finalise = intent === "finalise"
  const payload = parseIntakeInterviewFormData(formData)

  let interviewId: string
  try {
    if (!sourceInterviewId) {
      const current = await loadCurrentIntakeInterview(clientId, context.practiceId)
      if (current?.status === "draft") {
        return {
          error: "A draft intake interview already exists for this client.",
        }
      }
      if (current?.status === "finalised") {
        return {
          error:
            "This client already has a finalised intake interview. Create a new version from that record instead.",
        }
      }
    }

    const result = await commitIntakeInterview({
      clientId,
      practiceId: context.practiceId,
      practitionerProfileId: context.practitionerProfileId,
      userId: context.userId,
      sourceInterviewId,
      payload,
      finalise,
    })
    interviewId = result.intakeInterviewId
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save intake interview."
    return { error: message }
  }

  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/intake-interview/${interviewId}`)
  redirect(`/clients/${clientId}/intake-interview/${interviewId}`)
}

export async function createIntakeInterviewVersionAction(
  clientId: string,
  previousVersionId: string
) {
  const context = await requirePractitionerContext()
  const client = await verifyClientInPractice(clientId, context.practiceId)
  if (!client) {
    throw new Error("Client not found.")
  }

  const previous = await loadIntakeInterviewForPractice(
    previousVersionId,
    clientId,
    context.practiceId
  )
  if (!previous) {
    throw new Error("Intake interview not found.")
  }

  const result = await createIntakeInterviewVersion({
    previousVersionId,
    clientId,
    practiceId: context.practiceId,
    practitionerProfileId: context.practitionerProfileId,
    userId: context.userId,
  })

  revalidatePath(`/clients/${clientId}`)
  redirect(`/clients/${clientId}/intake-interview/${result.intakeInterviewId}/edit`)
}
