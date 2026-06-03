"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { practices } from "@/db/schema"
import { requirePractitionerContext, getPracticeForContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type PracticeFormState = {
  error?: string
  success?: boolean
}

export async function getPractice() {
  const context = await requirePractitionerContext()
  return getPracticeForContext(context.practiceId)
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
  const address = String(formData.get("address") ?? "").trim() || null
  const phone = String(formData.get("phone") ?? "").trim() || null
  const email = String(formData.get("email") ?? "").trim() || null

  if (!practiceName) {
    return { error: "Practice name is required." }
  }

  await db
    .update(practices)
    .set({
      practiceName,
      timezone,
      address,
      phone,
      email,
      updatedAt: new Date(),
    })
    .where(eq(practices.practiceId, context.practiceId))

  revalidatePath("/practice")
  return { success: true }
}
