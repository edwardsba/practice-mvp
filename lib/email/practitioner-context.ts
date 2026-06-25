import { eq } from "drizzle-orm"

import { practitionerProfiles, practices } from "@/db/schema"
import { db } from "@/lib/db"
import { formatPractitionerPreferredName } from "@/lib/practitioner/format"

export async function getQuestionnaireEmailContext(
  practiceId: string,
  practitionerProfileId: string
) {
  const [practitioner] = await db
    .select({
      firstName: practitionerProfiles.firstName,
      preferredName: practitionerProfiles.preferredName,
      lastName: practitionerProfiles.lastName,
    })
    .from(practitionerProfiles)
    .where(eq(practitionerProfiles.practitionerProfileId, practitionerProfileId))
    .limit(1)

  const [practice] = await db
    .select({
      practiceName: practices.practiceName,
      address: practices.address,
      locationNickname: practices.locationNickname,
    })
    .from(practices)
    .where(eq(practices.practiceId, practiceId))
    .limit(1)

  if (!practitioner || !practice) {
    return null
  }

  const practitionerName = formatPractitionerPreferredName(practitioner)

  return {
    practiceName: practice.practiceName,
    practiceAddress: practice.address,
    locationNickname: practice.locationNickname,
    practitionerName,
  }
}
