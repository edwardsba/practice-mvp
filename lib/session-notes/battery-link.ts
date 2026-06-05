import { and, desc, eq } from "drizzle-orm"

import { batteryInstances } from "@/db/schema"
import { db } from "@/lib/db"

/** Find the battery instance created when a pre-session battery was sent for an appointment. */
export async function findBatteryInstanceForAppointment(
  clientId: string,
  practiceId: string,
  preSessionBatterySentAt: Date | null
): Promise<string | null> {
  if (!preSessionBatterySentAt) {
    return null
  }

  const windowStart = new Date(preSessionBatterySentAt.getTime() - 5 * 60 * 1000)
  const windowEnd = new Date(preSessionBatterySentAt.getTime() + 2 * 60 * 60 * 1000)

  const batteries = await db
    .select({
      batteryInstanceId: batteryInstances.batteryInstanceId,
      createdAt: batteryInstances.createdAt,
    })
    .from(batteryInstances)
    .where(
      and(
        eq(batteryInstances.clientId, clientId),
        eq(batteryInstances.practiceId, practiceId)
      )
    )
    .orderBy(desc(batteryInstances.createdAt))
    .limit(10)

  for (const battery of batteries) {
    const createdAt = battery.createdAt
    if (createdAt >= windowStart && createdAt <= windowEnd) {
      return battery.batteryInstanceId
    }
  }

  return null
}
