"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type ClientFormState = {
  error?: string
  success?: boolean
}

export async function getActiveClients() {
  const context = await requirePractitionerContext()

  return db
    .select({
      clientId: clients.clientId,
      firstName: clients.firstName,
      lastName: clients.lastName,
      email: clients.email,
      phone: clients.phone,
      dateOfBirth: clients.dateOfBirth,
    })
    .from(clients)
    .where(
      and(
        eq(clients.practiceId, context.practiceId),
        eq(clients.isActive, true)
      )
    )
    .orderBy(clients.lastName, clients.firstName)
}

export async function createClient(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const context = await requirePractitionerContext()

  const firstName = String(formData.get("first_name") ?? "").trim()
  const lastName = String(formData.get("last_name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim() || null
  const phone = String(formData.get("phone") ?? "").trim() || null
  const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim() || null

  if (!firstName || !lastName) {
    return { error: "First name and last name are required." }
  }

  await db.insert(clients).values({
    practiceId: context.practiceId,
    firstName,
    lastName,
    email,
    phone,
    dateOfBirth,
  })

  revalidatePath("/clients")
  return { success: true }
}
