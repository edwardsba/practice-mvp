import { and, eq } from "drizzle-orm"

import {
  fundingApprovals,
  professionalOrganisationLinks,
  professionalOrganisations,
  professionals,
} from "@/db/schema"
import { db } from "@/lib/db"

export type ReferrerEmailOptions = {
  organisationName: string | null
  email: string | null
  claimsEmail: string | null
  secureMessaging: string | null
  faxEmail: string | null
}

export async function getReferrerEmailOptions(
  fundingApprovalId: string,
  practiceId: string
): Promise<ReferrerEmailOptions | null> {
  const [row] = await db
    .select({
      organisationName: professionalOrganisations.organisationName,
      email: professionalOrganisations.email,
      claimsEmail: professionalOrganisations.claimsEmail,
      secureMessaging: professionalOrganisations.secureMessaging,
      faxEmail: professionalOrganisations.faxEmail,
    })
    .from(fundingApprovals)
    .leftJoin(
      professionals,
      eq(fundingApprovals.referrerId, professionals.professionalId)
    )
    .leftJoin(
      professionalOrganisationLinks,
      and(
        eq(professionalOrganisationLinks.professionalId, professionals.professionalId),
        eq(professionalOrganisationLinks.isActive, true)
      )
    )
    .leftJoin(
      professionalOrganisations,
      eq(
        professionalOrganisationLinks.organisationId,
        professionalOrganisations.organisationId
      )
    )
    .where(
      and(
        eq(fundingApprovals.fundingApprovalId, fundingApprovalId),
        eq(fundingApprovals.practiceId, practiceId)
      )
    )
    .limit(1)

  return row ?? null
}
