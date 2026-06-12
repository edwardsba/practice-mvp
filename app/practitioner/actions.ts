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
  const calendarStartTimeRaw = String(
    formData.get("calendar_start_time") ?? ""
  ).trim()
  const calendarEndTimeRaw = String(formData.get("calendar_end_time") ?? "").trim()
  const calendarIntervalMinutes = Number(
    formData.get("calendar_interval_minutes")
  )

  if (!firstName) {
    return { error: "First name is required." }
  }

  if (!lastName) {
    return { error: "Last name is required." }
  }

  const calendarStartTime = normalizeTimeInput(calendarStartTimeRaw)
  const calendarEndTime = normalizeTimeInput(calendarEndTimeRaw)

  if (!calendarStartTime || !calendarEndTime) {
    return { error: "Calendar start and end times are required." }
  }

  if (
    !Number.isInteger(calendarIntervalMinutes) ||
    ![15, 30, 60].includes(calendarIntervalMinutes)
  ) {
    return { error: "Calendar interval must be 15, 30, or 60 minutes." }
  }

  if (calendarStartTime >= calendarEndTime) {
    return { error: "Calendar start time must be before end time." }
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
      calendarStartTime,
      calendarEndTime,
      calendarIntervalMinutes,
      updatedAt: new Date(),
    })
    .where(
      eq(practitionerProfiles.practitionerProfileId, context.practitionerProfileId)
    )

  revalidatePath("/practitioner")
  revalidatePath("/practitioner/edit")
  redirect("/practitioner")
}

function normalizeTimeInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = match[3] ? Number(match[3]) : 0

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}
