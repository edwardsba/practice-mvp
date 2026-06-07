import { eq } from "drizzle-orm"

import { practitionerProfiles, practices } from "@/db/schema"
import { db } from "@/lib/db"
import { formatPractitionerName } from "@/lib/practitioner/format"

export async function getQuestionnaireEmailContext(
  practiceId: string,
  practitionerProfileId: string
) {
  const [practitioner] = await db
    .select({
      title: practitionerProfiles.title,
      firstName: practitionerProfiles.firstName,
      preferredName: practitionerProfiles.preferredName,
      lastName: practitionerProfiles.lastName,
      reportSignature: practitionerProfiles.reportSignature,
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

  const practitionerName = formatPractitionerName(practitioner)

  return {
    practiceName: practice.practiceName,
    practitionerName,
  }
}
