import { eq } from "drizzle-orm"

import { assessmentAccessLinks } from "@/db/schema"
import { db } from "@/lib/db"

/** True when this instance was completed by the client via an access link. */
export async function instanceHasAccessLink(
  assessmentInstanceId: string
): Promise<boolean> {
  const [link] = await db
    .select({
      assessmentAccessLinkId: assessmentAccessLinks.assessmentAccessLinkId,
    })
    .from(assessmentAccessLinks)
    .where(eq(assessmentAccessLinks.assessmentInstanceId, assessmentInstanceId))
    .limit(1)
  return Boolean(link)
}
