"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { practitionerProfiles } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type PractitionerFormState = {
  error?: string
  success?: boolean
}

export async function getPractitionerProfile() {
  const context = await requirePractitionerContext()

  const [profile] = await db
    .select()
    .from(practitionerProfiles)
    .where(
      eq(practitionerProfiles.practitionerProfileId, context.practitionerProfileId)
    )
    .limit(1)

  return profile ?? null
}

export async function updatePractitionerProfile(
  _prevState: PractitionerFormState,
  formData: FormData
): Promise<PractitionerFormState> {
  const context = await requirePractitionerContext()

  const title = String(formData.get("title") ?? "").trim() || null
  const fullName = String(formData.get("full_name") ?? "").trim()
  const registrationNumber =
    String(formData.get("registration_number") ?? "").trim() || null
  const registrationBody =
    String(formData.get("registration_body") ?? "").trim() || null

  if (!fullName) {
    return { error: "Full name is required." }
  }

  await db
    .update(practitionerProfiles)
    .set({
      title,
      fullName,
      registrationNumber,
      registrationBody,
      updatedAt: new Date(),
    })
    .where(
      eq(practitionerProfiles.practitionerProfileId, context.practitionerProfileId)
    )

  revalidatePath("/practitioner")
  return { success: true }
}
