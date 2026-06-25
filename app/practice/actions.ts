"use server"

import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { practices } from "@/db/schema"
import { requirePractitionerContext, getPracticeForContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type PracticeFormState = {
  error?: string
  success?: boolean
}

export type CreatePracticeState = {
  error?: string
  practiceId?: string
  practiceName?: string
}

export async function getPractice() {
  const context = await requirePractitionerContext()
  return getPracticeForContext(context.practiceId)
}

export async function getAllActivePractices() {
  await requirePractitionerContext()

  return db
    .select({
      practiceId: practices.practiceId,
      practiceName: practices.practiceName,
    })
    .from(practices)
    .where(eq(practices.isActive, true))
    .orderBy(asc(practices.practiceName))
}

export async function createPracticeInline(
  _prevState: CreatePracticeState,
  formData: FormData
): Promise<CreatePracticeState> {
  await requirePractitionerContext()

  const practiceName = String(formData.get("practice_name") ?? "").trim()
  const timezone =
    String(formData.get("timezone") ?? "Australia/Sydney").trim() ||
    "Australia/Sydney"

  if (!practiceName) {
    return { error: "Practice name is required." }
  }

  try {
    const [practice] = await db
      .insert(practices)
      .values({
        practiceName,
        timezone,
        updatedAt: new Date(),
      })
      .returning({
        practiceId: practices.practiceId,
        practiceName: practices.practiceName,
      })

    revalidatePath("/practice")
    return {
      practiceId: practice.practiceId,
      practiceName: practice.practiceName,
    }
  } catch {
    return { error: "Unable to create practice. Please try again." }
  }
}

export async function updatePractice(
  _prevState: PracticeFormState,
  formData: FormData
): Promise<PracticeFormState> {
  const context = await requirePractitionerContext()

  const practiceName = String(formData.get("practice_name") ?? "").trim()
  const timezone =
    String(formData.get("timezone") ?? "Australia/Sydney").trim() ||
    "Australia/Sydney"
  const locationNickname =
    String(formData.get("location_nickname") ?? "").trim() || null
  const address = String(formData.get("address") ?? "").trim() || null
  const phone = String(formData.get("phone") ?? "").trim() || null
  const fax = String(formData.get("fax") ?? "").trim() || null
  const email = String(formData.get("email") ?? "").trim() || null
  const website = String(formData.get("website") ?? "").trim() || null
  const abn = String(formData.get("abn") ?? "").trim() || null

  if (!practiceName) {
    return { error: "Practice name is required." }
  }

  await db
    .update(practices)
    .set({
      practiceName,
      locationNickname,
      timezone,
      address,
      phone,
      fax,
      email,
      website,
      abn,
      updatedAt: new Date(),
    })
    .where(eq(practices.practiceId, context.practiceId))

  revalidatePath("/practice")
  revalidatePath("/practice/edit")
  revalidatePath("/practitioner")
  return { success: true }
}
