"use server"

import { and, asc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import {
  practitionerAvailabilityBlocks,
  practitionerPracticeMemberships,
  practices,
} from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import type { AvailabilityMode } from "@/lib/practitioner/format"
import { AVAILABILITY_MODES } from "@/lib/practitioner/format"

export type AvailabilityBlockInput = {
  dayOfWeek: number
  startTime: string
  endTime: string
  mode: AvailabilityMode
}

export type MembershipFormState = {
  error?: string
  success?: boolean
  membershipId?: string
}

function normalizeTime(value: string): string | null {
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

function parseAvailabilityBlocks(formData: FormData): AvailabilityBlockInput[] {
  const raw = String(formData.get("availability_blocks") ?? "").trim()
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as AvailabilityBlockInput[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function validateBlocks(
  blocks: AvailabilityBlockInput[]
): AvailabilityBlockInput[] | { error: string } {
  const validated: AvailabilityBlockInput[] = []

  for (const block of blocks) {
    if (block.dayOfWeek < 0 || block.dayOfWeek > 6) {
      return { error: "Each availability block needs a valid day of week." }
    }

    const startTime = normalizeTime(block.startTime)
    const endTime = normalizeTime(block.endTime)

    if (!startTime || !endTime) {
      return { error: "Each availability block needs valid start and end times." }
    }

    if (!AVAILABILITY_MODES.includes(block.mode)) {
      return { error: "Each availability block needs a valid mode." }
    }

    validated.push({
      dayOfWeek: block.dayOfWeek,
      startTime,
      endTime,
      mode: block.mode,
    })
  }

  return validated
}

async function verifyMembershipOwnership(membershipId: string) {
  const context = await requirePractitionerContext()

  const [membership] = await db
    .select({
      membershipId: practitionerPracticeMemberships.membershipId,
      practitionerProfileId:
        practitionerPracticeMemberships.practitionerProfileId,
      practiceId: practitionerPracticeMemberships.practiceId,
    })
    .from(practitionerPracticeMemberships)
    .where(
      and(
        eq(practitionerPracticeMemberships.membershipId, membershipId),
        eq(
          practitionerPracticeMemberships.practitionerProfileId,
          context.practitionerProfileId
        ),
        eq(practitionerPracticeMemberships.isActive, true)
      )
    )
    .limit(1)

  return membership ?? null
}

export async function getMemberships(practitionerProfileId: string) {
  const context = await requirePractitionerContext()
  if (context.practitionerProfileId !== practitionerProfileId) {
    return []
  }

  const memberships = await db
    .select({
      membershipId: practitionerPracticeMemberships.membershipId,
      practiceId: practitionerPracticeMemberships.practiceId,
      practiceName: practices.practiceName,
      medicareProviderNumber:
        practitionerPracticeMemberships.medicareProviderNumber,
      role: practitionerPracticeMemberships.role,
    })
    .from(practitionerPracticeMemberships)
    .innerJoin(
      practices,
      eq(practitionerPracticeMemberships.practiceId, practices.practiceId)
    )
    .where(
      and(
        eq(
          practitionerPracticeMemberships.practitionerProfileId,
          practitionerProfileId
        ),
        eq(practitionerPracticeMemberships.isActive, true)
      )
    )
    .orderBy(asc(practices.practiceName))

  if (memberships.length === 0) {
    return []
  }

  const membershipIds = memberships.map((membership) => membership.membershipId)
  const blocks = await db
    .select({
      blockId: practitionerAvailabilityBlocks.blockId,
      membershipId: practitionerAvailabilityBlocks.membershipId,
      dayOfWeek: practitionerAvailabilityBlocks.dayOfWeek,
      startTime: practitionerAvailabilityBlocks.startTime,
      endTime: practitionerAvailabilityBlocks.endTime,
      mode: practitionerAvailabilityBlocks.mode,
    })
    .from(practitionerAvailabilityBlocks)
    .where(
      and(
        eq(practitionerAvailabilityBlocks.isActive, true),
        inArray(practitionerAvailabilityBlocks.membershipId, membershipIds)
      )
    )
    .orderBy(
      asc(practitionerAvailabilityBlocks.dayOfWeek),
      asc(practitionerAvailabilityBlocks.startTime)
    )

  return memberships.map((membership) => ({
    ...membership,
    availabilityBlocks: blocks.filter(
      (block) => block.membershipId === membership.membershipId
    ),
  }))
}

export async function getMembership(membershipId: string) {
  const membership = await verifyMembershipOwnership(membershipId)
  if (!membership) {
    return null
  }

  const memberships = await getMemberships(membership.practitionerProfileId)
  return memberships.find((item) => item.membershipId === membershipId) ?? null
}

export async function getPracticesForMembershipSelect() {
  const context = await requirePractitionerContext()

  const existing = await db
    .select({ practiceId: practitionerPracticeMemberships.practiceId })
    .from(practitionerPracticeMemberships)
    .where(
      and(
        eq(
          practitionerPracticeMemberships.practitionerProfileId,
          context.practitionerProfileId
        ),
        eq(practitionerPracticeMemberships.isActive, true)
      )
    )

  const existingIds = new Set(existing.map((row) => row.practiceId))

  const allPractices = await db
    .select({
      practiceId: practices.practiceId,
      practiceName: practices.practiceName,
    })
    .from(practices)
    .where(eq(practices.isActive, true))
    .orderBy(asc(practices.practiceName))

  return allPractices.filter((practice) => !existingIds.has(practice.practiceId))
}

export async function upsertAvailabilityBlocks(
  membershipId: string,
  blocks: AvailabilityBlockInput[]
) {
  const membership = await verifyMembershipOwnership(membershipId)
  if (!membership) {
    return { error: "Membership not found." }
  }

  const validated = validateBlocks(blocks)
  if ("error" in validated) {
    return validated
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(practitionerAvailabilityBlocks)
      .set({ isActive: false, updatedAt: now })
      .where(eq(practitionerAvailabilityBlocks.membershipId, membershipId))

    if (validated.length > 0) {
      await tx.insert(practitionerAvailabilityBlocks).values(
        validated.map((block) => ({
          membershipId,
          dayOfWeek: block.dayOfWeek,
          startTime: block.startTime,
          endTime: block.endTime,
          mode: block.mode,
          updatedAt: now,
        }))
      )
    }
  })

  revalidatePath("/practitioner")
  return { success: true }
}

export async function upsertMembership(
  membershipId: string | undefined,
  _prevState: MembershipFormState,
  formData: FormData
): Promise<MembershipFormState> {
  const context = await requirePractitionerContext()
  const practiceId = String(formData.get("practice_id") ?? "").trim()
  const role = String(formData.get("role") ?? "").trim() || null
  const medicareProviderNumber =
    String(formData.get("medicare_provider_number") ?? "").trim() || null
  const blocks = parseAvailabilityBlocks(formData)

  const validatedBlocks = validateBlocks(blocks)
  if ("error" in validatedBlocks) {
    return validatedBlocks
  }

  const now = new Date()
  let savedMembershipId = membershipId

  try {
    if (membershipId) {
      const existing = await verifyMembershipOwnership(membershipId)
      if (!existing) {
        return { error: "Membership not found." }
      }

      await db
        .update(practitionerPracticeMemberships)
        .set({
          role,
          medicareProviderNumber,
          updatedAt: now,
        })
        .where(eq(practitionerPracticeMemberships.membershipId, membershipId))
    } else {
      if (!practiceId) {
        return { error: "Practice is required." }
      }

      const [practice] = await db
        .select({ practiceId: practices.practiceId })
        .from(practices)
        .where(
          and(eq(practices.practiceId, practiceId), eq(practices.isActive, true))
        )
        .limit(1)

      if (!practice) {
        return { error: "Practice not found." }
      }

      const [duplicate] = await db
        .select({ membershipId: practitionerPracticeMemberships.membershipId })
        .from(practitionerPracticeMemberships)
        .where(
          and(
            eq(
              practitionerPracticeMemberships.practitionerProfileId,
              context.practitionerProfileId
            ),
            eq(practitionerPracticeMemberships.practiceId, practiceId),
            eq(practitionerPracticeMemberships.isActive, true)
          )
        )
        .limit(1)

      if (duplicate) {
        return { error: "You are already linked to this practice." }
      }

      const [created] = await db
        .insert(practitionerPracticeMemberships)
        .values({
          practitionerProfileId: context.practitionerProfileId,
          practiceId,
          role,
          medicareProviderNumber,
          updatedAt: now,
        })
        .returning({
          membershipId: practitionerPracticeMemberships.membershipId,
        })

      savedMembershipId = created.membershipId
    }

    if (!savedMembershipId) {
      return { error: "Unable to save membership." }
    }

    const blockResult = await upsertAvailabilityBlocks(
      savedMembershipId,
      validatedBlocks
    )
    if ("error" in blockResult) {
      return { error: blockResult.error }
    }
  } catch {
    return { error: "Unable to save membership. Please try again." }
  }

  revalidatePath("/practitioner")
  revalidatePath(`/practitioner/memberships/${savedMembershipId}/edit`)
  return { success: true, membershipId: savedMembershipId }
}

export async function deleteMembership(membershipId: string) {
  const membership = await verifyMembershipOwnership(membershipId)
  if (!membership) {
    return { error: "Membership not found." }
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(practitionerPracticeMemberships)
      .set({ isActive: false, updatedAt: now })
      .where(eq(practitionerPracticeMemberships.membershipId, membershipId))

    await tx
      .update(practitionerAvailabilityBlocks)
      .set({ isActive: false, updatedAt: now })
      .where(eq(practitionerAvailabilityBlocks.membershipId, membershipId))
  })

  revalidatePath("/practitioner")
  return { success: true }
}
