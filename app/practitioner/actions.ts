"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { practitionerProfiles } from "@/db/schema"
import { getMemberships } from "@/lib/actions/practitioner-practice"
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

  if (!profile) {
    return null
  }

  const memberships = await getMemberships(context.practitionerProfileId)

  return {
    ...profile,
    memberships,
  }
}

export async function updatePractitionerProfile(
  _prevState: PractitionerFormState,
  formData: FormData
): Promise<PractitionerFormState> {
  const context = await requirePractitionerContext()

  const title = String(formData.get("title") ?? "").trim() || null
  const firstName = String(formData.get("first_name") ?? "").trim()
  const preferredName =
    String(formData.get("preferred_name") ?? "").trim() || null
  const lastName = String(formData.get("last_name") ?? "").trim()
  const registrationNumber =
    String(formData.get("registration_number") ?? "").trim() || null
  const registrationBody =
    String(formData.get("registration_body") ?? "").trim() || null
  const phone = String(formData.get("phone") ?? "").trim() || null
  const email = String(formData.get("email") ?? "").trim() || null
  const reportSignature =
    String(formData.get("report_signature") ?? "").trim() || null

  if (!firstName) {
    return { error: "First name is required." }
  }

  if (!lastName) {
    return { error: "Last name is required." }
  }

  await db
    .update(practitionerProfiles)
    .set({
      title,
      firstName,
      preferredName,
      lastName,
      registrationNumber,
      registrationBody,
      phone,
      email,
      reportSignature,
      updatedAt: new Date(),
    })
    .where(
      eq(practitionerProfiles.practitionerProfileId, context.practitionerProfileId)
    )

  revalidatePath("/practitioner")
  revalidatePath("/practitioner/edit")
  redirect("/practitioner")
}
