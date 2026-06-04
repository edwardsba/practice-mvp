import { eq } from "drizzle-orm"

import { practitionerProfiles, practices } from "@/db/schema"
import { db } from "@/lib/db"

export async function getQuestionnaireEmailContext(
  practiceId: string,
  practitionerProfileId: string
) {
  const [practitioner] = await db
    .select({
      title: practitionerProfiles.title,
      fullName: practitionerProfiles.fullName,
    })
    .from(practitionerProfiles)
    .where(eq(practitionerProfiles.practitionerProfileId, practitionerProfileId))
    .limit(1)

  const [practice] = await db
    .select({ practiceName: practices.practiceName })
    .from(practices)
    .where(eq(practices.practiceId, practiceId))
    .limit(1)

  if (!practitioner || !practice) {
    return null
  }

  const practitionerName = [practitioner.title, practitioner.fullName]
    .filter(Boolean)
    .join(" ")

  return {
    practiceName: practice.practiceName,
    practitionerName: practitionerName || practitioner.fullName,
  }
}
