"use server"

import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  appointmentTypeFees,
  appointmentTypes,
  claimTypes,
  practices,
  practitionerPracticeMemberships,
} from "@/db/schema"
import { pickCurrentFee } from "@/lib/appointment-types/format"
import { todayDateString } from "@/lib/appointments/format"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

export type AppointmentTypeFormState = {
  error?: string
  success?: boolean
  appointmentTypeId?: string
}

type FeeInput = {
  fee: string
  tax: string
  startDate: string
  endDate: string | null
  status: string
}

async function verifyPracticeId(practiceId: string) {
  const context = await requirePractitionerContext()
  if (context.practiceId !== practiceId) {
    throw new Error("Unauthorized practice access.")
  }
  return context
}

function parseFees(raw: string): FeeInput[] | { error: string } {
  if (!raw.trim()) {
    return { error: "At least one fee row is required." }
  }

  try {
    const parsed = JSON.parse(raw) as FeeInput[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { error: "At least one fee row is required." }
    }

    for (const row of parsed) {
      if (!row.startDate?.trim()) {
        return { error: "Each fee row needs a start date." }
      }
      const fee = Number(row.fee)
      const tax = Number(row.tax ?? 0)
      if (Number.isNaN(fee) || fee < 0) {
        return { error: "Each fee row needs a valid fee amount." }
      }
      if (Number.isNaN(tax) || tax < 0) {
        return { error: "Each fee row needs a valid tax amount." }
      }
      if (row.status !== "active" && row.status !== "inactive") {
        return { error: "Each fee row needs a valid status." }
      }
    }

    return parsed
  } catch {
    return { error: "Unable to parse fee rows." }
  }
}

function calculateTotal(fee: number, tax: number) {
  return (fee + tax).toFixed(2)
}

export async function getClaimTypesForAppointmentTypes(practiceId: string) {
  await verifyPracticeId(practiceId)

  return db
    .select({
      claimTypeId: claimTypes.claimTypeId,
      claimTypeName: claimTypes.claimTypeName,
    })
    .from(claimTypes)
    .where(
      and(eq(claimTypes.practiceId, practiceId), eq(claimTypes.isActive, true))
    )
    .orderBy(asc(claimTypes.claimTypeName))
}

export async function getPracticeMembershipsForForm(practiceId: string) {
  await verifyPracticeId(practiceId)

  return db
    .select({
      membershipId: practitionerPracticeMemberships.membershipId,
      practiceName: practices.practiceName,
    })
    .from(practitionerPracticeMemberships)
    .innerJoin(
      practices,
      eq(practitionerPracticeMemberships.practiceId, practices.practiceId)
    )
    .where(
      and(
        eq(practitionerPracticeMemberships.practiceId, practiceId),
        eq(practitionerPracticeMemberships.isActive, true)
      )
    )
    .orderBy(asc(practices.practiceName))
}

export async function getAppointmentTypes(practiceId: string) {
  await verifyPracticeId(practiceId)
  const today = todayDateString()

  const types = await db
    .select({
      appointmentTypeId: appointmentTypes.appointmentTypeId,
      nickname: appointmentTypes.nickname,
      name: appointmentTypes.name,
      referenceNumber: appointmentTypes.referenceNumber,
      durationMinutes: appointmentTypes.durationMinutes,
      status: appointmentTypes.status,
      claimTypeName: claimTypes.claimTypeName,
      practiceName: practices.practiceName,
    })
    .from(appointmentTypes)
    .leftJoin(claimTypes, eq(appointmentTypes.claimTypeId, claimTypes.claimTypeId))
    .leftJoin(
      practitionerPracticeMemberships,
      eq(appointmentTypes.membershipId, practitionerPracticeMemberships.membershipId)
    )
    .leftJoin(
      practices,
      eq(practitionerPracticeMemberships.practiceId, practices.practiceId)
    )
    .where(
      and(
        eq(appointmentTypes.practiceId, practiceId),
        eq(appointmentTypes.isActive, true)
      )
    )
    .orderBy(asc(appointmentTypes.nickname))

  if (types.length === 0) {
    return []
  }

  const fees = await db
    .select({
      appointmentTypeId: appointmentTypeFees.appointmentTypeId,
      fee: appointmentTypeFees.fee,
      tax: appointmentTypeFees.tax,
      total: appointmentTypeFees.total,
      startDate: appointmentTypeFees.startDate,
      endDate: appointmentTypeFees.endDate,
      status: appointmentTypeFees.status,
    })
    .from(appointmentTypeFees)
    .where(
      inArray(
        appointmentTypeFees.appointmentTypeId,
        types.map((type) => type.appointmentTypeId)
      )
    )

  return types.map((type) => ({
    ...type,
    currentFee: pickCurrentFee(
      fees.filter((fee) => fee.appointmentTypeId === type.appointmentTypeId),
      today
    ),
  }))
}

export async function getAppointmentTypeById(
  practiceId: string,
  appointmentTypeId: string
) {
  await verifyPracticeId(practiceId)

  const [type] = await db
    .select({
      appointmentTypeId: appointmentTypes.appointmentTypeId,
      nickname: appointmentTypes.nickname,
      name: appointmentTypes.name,
      referenceNumber: appointmentTypes.referenceNumber,
      claimTypeId: appointmentTypes.claimTypeId,
      membershipId: appointmentTypes.membershipId,
      durationMinutes: appointmentTypes.durationMinutes,
      status: appointmentTypes.status,
      claimTypeName: claimTypes.claimTypeName,
      practiceName: practices.practiceName,
    })
    .from(appointmentTypes)
    .leftJoin(claimTypes, eq(appointmentTypes.claimTypeId, claimTypes.claimTypeId))
    .leftJoin(
      practitionerPracticeMemberships,
      eq(appointmentTypes.membershipId, practitionerPracticeMemberships.membershipId)
    )
    .leftJoin(
      practices,
      eq(practitionerPracticeMemberships.practiceId, practices.practiceId)
    )
    .where(
      and(
        eq(appointmentTypes.appointmentTypeId, appointmentTypeId),
        eq(appointmentTypes.practiceId, practiceId),
        eq(appointmentTypes.isActive, true)
      )
    )
    .limit(1)

  if (!type) {
    return null
  }

  const fees = await db
    .select({
      feeId: appointmentTypeFees.feeId,
      fee: appointmentTypeFees.fee,
      tax: appointmentTypeFees.tax,
      total: appointmentTypeFees.total,
      startDate: appointmentTypeFees.startDate,
      endDate: appointmentTypeFees.endDate,
      status: appointmentTypeFees.status,
    })
    .from(appointmentTypeFees)
    .where(eq(appointmentTypeFees.appointmentTypeId, appointmentTypeId))
    .orderBy(desc(appointmentTypeFees.startDate))

  return {
    ...type,
    fees,
  }
}

export async function upsertAppointmentType(
  practiceId: string,
  appointmentTypeId: string | undefined,
  _prevState: AppointmentTypeFormState,
  formData: FormData
): Promise<AppointmentTypeFormState> {
  await verifyPracticeId(practiceId)

  const nickname = String(formData.get("nickname") ?? "").trim()
  const name = String(formData.get("name") ?? "").trim()
  const referenceNumber =
    String(formData.get("reference_number") ?? "").trim() || null
  const claimTypeId =
    String(formData.get("claim_type_id") ?? "").trim() || null
  const membershipId =
    String(formData.get("membership_id") ?? "").trim() || null
  const durationMinutes = Number(formData.get("duration_minutes") ?? 50)
  const status = String(formData.get("status") ?? "active").trim()
  const feesRaw = String(formData.get("fee_rows") ?? "")

  if (!nickname || !name) {
    return { error: "Nickname and name are required." }
  }

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duration must be a positive number of minutes." }
  }

  if (status !== "active" && status !== "inactive") {
    return { error: "Status must be active or inactive." }
  }

  const parsedFees = parseFees(feesRaw)
  if ("error" in parsedFees) {
    return { error: parsedFees.error }
  }

  const now = new Date()
  let savedAppointmentTypeId = appointmentTypeId

  try {
    if (appointmentTypeId) {
      const [existing] = await db
        .select({ appointmentTypeId: appointmentTypes.appointmentTypeId })
        .from(appointmentTypes)
        .where(
          and(
            eq(appointmentTypes.appointmentTypeId, appointmentTypeId),
            eq(appointmentTypes.practiceId, practiceId),
            eq(appointmentTypes.isActive, true)
          )
        )
        .limit(1)

      if (!existing) {
        return { error: "Appointment type not found." }
      }

      await db
        .update(appointmentTypes)
        .set({
          nickname,
          name,
          referenceNumber,
          claimTypeId,
          membershipId,
          durationMinutes,
          status,
          updatedAt: now,
        })
        .where(eq(appointmentTypes.appointmentTypeId, appointmentTypeId))
    } else {
      const [created] = await db
        .insert(appointmentTypes)
        .values({
          practiceId,
          nickname,
          name,
          referenceNumber,
          claimTypeId,
          membershipId,
          durationMinutes,
          status,
          updatedAt: now,
        })
        .returning({ appointmentTypeId: appointmentTypes.appointmentTypeId })

      if (!created) {
        return { error: "Unable to create appointment type." }
      }

      savedAppointmentTypeId = created.appointmentTypeId
    }

    if (!savedAppointmentTypeId) {
      return { error: "Unable to save appointment type." }
    }

    await db
      .delete(appointmentTypeFees)
      .where(eq(appointmentTypeFees.appointmentTypeId, savedAppointmentTypeId))

    await db.insert(appointmentTypeFees).values(
      parsedFees.map((row) => {
        const fee = Number(row.fee)
        const tax = Number(row.tax ?? 0)
        return {
          appointmentTypeId: savedAppointmentTypeId!,
          fee: fee.toFixed(2),
          tax: tax.toFixed(2),
          total: calculateTotal(fee, tax),
          startDate: row.startDate.trim(),
          endDate: row.endDate?.trim() || null,
          status: row.status,
          updatedAt: now,
        }
      })
    )
  } catch {
    return { error: "Unable to save appointment type. Please try again." }
  }

  revalidatePath("/settings/appointment-types")
  revalidatePath(`/settings/appointment-types/${savedAppointmentTypeId}`)
  revalidatePath(`/settings/appointment-types/${savedAppointmentTypeId}/edit`)

  redirect(`/settings/appointment-types/${savedAppointmentTypeId}`)
}
