import { config } from "dotenv"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { appointmentTypes, practices } from "./schema"

config({ path: ".env.local" })

const MODE_BY_NICKNAME: Record<string, string> = {
  "Medicare F2F": "face_to_face",
  "Medicare Telehealth": "online",
  Private: "face_to_face",
  NDIS: "face_to_face",
}

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

  for (const [nickname, mode] of Object.entries(MODE_BY_NICKNAME)) {
    const result = await db
      .update(appointmentTypes)
      .set({ mode, updatedAt: now })
      .where(
        and(
          eq(appointmentTypes.practiceId, practice.practiceId),
          eq(appointmentTypes.nickname, nickname)
        )
      )
      .returning({ appointmentTypeId: appointmentTypes.appointmentTypeId })

    if (result.length > 0) {
      console.log(`Updated mode for ${nickname} → ${mode}`)
    } else {
      console.log(`No appointment type found for nickname: ${nickname}`)
    }
  }

  await pool.end()
  console.log("Appointment type mode seed completed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
