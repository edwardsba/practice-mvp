import { config } from "dotenv"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import {
  appointmentTypeFees,
  appointmentTypes,
  claimTypes,
  practitionerPracticeMemberships,
  practices,
} from "./schema"

config({ path: ".env.local" })

type SeedAppointmentType = {
  nickname: string
  name: string
  referenceNumber: string | null
  claimTypeName: string
  durationMinutes: number
  fee: string
  tax: string
  total: string
  startDate: string
}

const SEED_TYPES: SeedAppointmentType[] = [
  {
    nickname: "Medicare F2F",
    name: "Individual Therapy — Medicare Face to Face",
    referenceNumber: "80110",
    claimTypeName: "Medicare",
    durationMinutes: 50,
    fee: "137.05",
    tax: "0.00",
    total: "137.05",
    startDate: "2024-11-01",
  },
  {
    nickname: "Medicare Telehealth",
    name: "Individual Therapy — Medicare Telehealth",
    referenceNumber: "91170",
    claimTypeName: "Medicare",
    durationMinutes: 50,
    fee: "137.05",
    tax: "0.00",
    total: "137.05",
    startDate: "2024-11-01",
  },
  {
    nickname: "Private",
    name: "Individual Therapy — Private",
    referenceNumber: null,
    claimTypeName: "Private",
    durationMinutes: 50,
    fee: "220.00",
    tax: "0.00",
    total: "220.00",
    startDate: "2024-11-01",
  },
  {
    nickname: "NDIS",
    name: "Individual Therapy — NDIS",
    referenceNumber: "15_054_0128_1_3",
    claimTypeName: "NDIS",
    durationMinutes: 50,
    fee: "214.41",
    tax: "0.00",
    total: "214.41",
    startDate: "2024-11-01",
  },
]

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.")
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool)
  const now = new Date()

  const [practice] = await db
    .select({ practiceId: practices.practiceId })
    .from(practices)
    .where(eq(practices.isActive, true))
    .limit(1)

  if (!practice) {
    throw new Error("No active practice found.")
  }

  const practiceId = practice.practiceId

  async function upsertClaimType(name: string) {
    const [existing] = await db
      .select()
      .from(claimTypes)
      .where(
        and(
          eq(claimTypes.practiceId, practiceId),
          eq(claimTypes.claimTypeName, name)
        )
      )
      .limit(1)

    if (existing) {
      return existing
    }

    const [created] = await db
      .insert(claimTypes)
      .values({
        practiceId,
        claimTypeName: name,
        updatedAt: now,
      })
      .returning()

    return created
  }

  const medicare = await upsertClaimType("Medicare")
  const ndis = await upsertClaimType("NDIS")
  const privateType = await upsertClaimType("Private")

  const claimTypeByName: Record<string, string> = {
    Medicare: medicare.claimTypeId,
    NDIS: ndis.claimTypeId,
    Private: privateType.claimTypeId,
  }

  const [membership] = await db
    .select({ membershipId: practitionerPracticeMemberships.membershipId })
    .from(practitionerPracticeMemberships)
    .where(
      and(
        eq(practitionerPracticeMemberships.practiceId, practiceId),
        eq(practitionerPracticeMemberships.isActive, true)
      )
    )
    .limit(1)

  for (const seed of SEED_TYPES) {
    const [existing] = await db
      .select({ appointmentTypeId: appointmentTypes.appointmentTypeId })
      .from(appointmentTypes)
      .where(
        and(
          eq(appointmentTypes.practiceId, practiceId),
          eq(appointmentTypes.nickname, seed.nickname)
        )
      )
      .limit(1)

    if (existing) {
      console.log(`Skipping existing appointment type: ${seed.nickname}`)
      continue
    }

    const [created] = await db
      .insert(appointmentTypes)
      .values({
        practiceId,
        nickname: seed.nickname,
        name: seed.name,
        referenceNumber: seed.referenceNumber,
        claimTypeId: claimTypeByName[seed.claimTypeName],
        membershipId: membership?.membershipId ?? null,
        durationMinutes: seed.durationMinutes,
        status: "active",
        updatedAt: now,
      })
      .returning({ appointmentTypeId: appointmentTypes.appointmentTypeId })

    if (!created) {
      throw new Error(`Unable to create appointment type: ${seed.nickname}`)
    }

    await db.insert(appointmentTypeFees).values({
      appointmentTypeId: created.appointmentTypeId,
      fee: seed.fee,
      tax: seed.tax,
      total: seed.total,
      startDate: seed.startDate,
      endDate: null,
      status: "active",
      updatedAt: now,
    })

    console.log(`Created appointment type: ${seed.nickname}`)
  }

  await pool.end()
  console.log("Appointment types seed completed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
