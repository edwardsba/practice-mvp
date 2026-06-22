"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { clients } from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  countActiveAppointments,
  countActiveClaims,
  countActiveCrisisPlans,
  countActiveFundingApprovalsForClient,
  countActiveTreatmentPlans,
  countNonFinalisedSessionNotes,
  countSimpleReports,
  logDeleteAuditEvent,
  performSoftDelete,
  verifyClientInPractice,
} from "@/lib/delete/delete-utils"

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

export async function getClientDeleteStatus(clientId: string) {
  const context = await requirePractitionerContext()

  if (!(await verifyClientInPractice(clientId, context.practiceId))) {
    return { blockedReason: "Client not found." }
  }

  const appointmentCount = await countActiveAppointments(
    clientId,
    context.practiceId
  )
  if (appointmentCount > 0) {
    return {
      blockedReason: `Cannot delete: client has ${appointmentCount} active appointments.`,
    }
  }

  const sessionNoteCount = await countNonFinalisedSessionNotes(
    clientId,
    context.practiceId
  )
  if (sessionNoteCount > 0) {
    return {
      blockedReason: `Cannot delete: client has ${sessionNoteCount} non-finalised session notes.`,
    }
  }

  const approvalCount = await countActiveFundingApprovalsForClient(
    clientId,
    context.practiceId
  )
  if (approvalCount > 0) {
    return {
      blockedReason: `Cannot delete: client has ${approvalCount} active funding approvals.`,
    }
  }

  const crisisPlanCount = await countActiveCrisisPlans(
    clientId,
    context.practiceId
  )
  if (crisisPlanCount > 0) {
    return {
      blockedReason: `Cannot delete: client has ${crisisPlanCount} active crisis plans.`,
    }
  }

  const treatmentPlanCount = await countActiveTreatmentPlans(
    clientId,
    context.practiceId
  )
  if (treatmentPlanCount > 0) {
    return {
      blockedReason: `Cannot delete: client has ${treatmentPlanCount} active treatment plans.`,
    }
  }

  const claimCount = await countActiveClaims(clientId, context.practiceId)
  if (claimCount > 0) {
    return {
      blockedReason: `Cannot delete: client has ${claimCount} active claims.`,
    }
  }

  const reportCount = await countSimpleReports(clientId, context.practiceId)
  if (reportCount > 0) {
    return { requiresReportConfirmation: true }
  }

  return {}
}

export async function deleteClient(
  clientId: string,
  options?: { deletionReason?: string; acknowledgeReports?: boolean }
): Promise<{
  success?: boolean
  error?: string
  blockedReason?: string
  hasReports?: boolean
}> {
  const context = await requirePractitionerContext()
  const status = await getClientDeleteStatus(clientId)

  if (status.blockedReason) {
    return { blockedReason: status.blockedReason }
  }

  if (status.requiresReportConfirmation && !options?.acknowledgeReports) {
    return {
      hasReports: true,
      blockedReason:
        "Extra confirmation required: this client has reports on file.",
    }
  }

  if (!(await verifyClientInPractice(clientId, context.practiceId))) {
    return { error: "Client not found." }
  }

  const result = await performSoftDelete({
    table: clients,
    id: clientId,
    idField: clients.clientId,
    practiceId: context.practiceId,
    practiceIdField: clients.practiceId,
  })

  if (!result.success) {
    return { error: result.error ?? "Unable to delete client." }
  }

  await logDeleteAuditEvent({
    practiceId: context.practiceId,
    userId: context.userId,
    clientId,
    eventType: "client.deleted",
    entityType: "client",
    entityId: clientId,
    deletionReason: options?.deletionReason,
  })

  revalidatePath("/clients")
  revalidatePath(`/clients/${clientId}`)
  redirect("/clients")
}
