import Link from "next/link"
import { notFound } from "next/navigation"
import { and, desc, eq } from "drizzle-orm"

import { ReportForm } from "@/app/clients/[client_id]/reports/new/report-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { clients, practitionerProfiles, practices, treatmentPlans } from "@/db/schema"
import { getClientFundingApprovalsForReport } from "@/lib/actions/funding"
import { getReportTypes } from "@/lib/actions/report-types"
import {
  formatPractitionerFormalName,
  formatPractitionerName,
} from "@/lib/practitioner/format"
import { getSignatureAsDataUrl } from "@/lib/practitioner/signature"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"

import "@/components/report/report-print.css"

export default async function NewReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string }>
  searchParams: Promise<{
    fundingApprovalId?: string
    reportRequirementId?: string
    returnTo?: string
  }>
}) {
  const { client_id: clientId } = await params
  const {
    fundingApprovalId: initialFundingApprovalId,
    reportRequirementId: initialRequirementId,
    returnTo,
  } = await searchParams
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
      dateOfBirth: clients.dateOfBirth,
    })
    .from(clients)
    .where(
      and(
        eq(clients.clientId, clientId),
        eq(clients.practiceId, context.practiceId),
        eq(clients.isActive, true)
      )
    )
    .limit(1)

  if (!client) {
    notFound()
  }

  const [practitioner] = await db
    .select({
      title: practitionerProfiles.title,
      firstName: practitionerProfiles.firstName,
      preferredName: practitionerProfiles.preferredName,
      lastName: practitionerProfiles.lastName,
      reportSignature: practitionerProfiles.reportSignature,
      signatureImagePath: practitionerProfiles.signatureImagePath,
    })
    .from(practitionerProfiles)
    .where(
      eq(practitionerProfiles.practitionerProfileId, context.practitionerProfileId)
    )
    .limit(1)

  const [practice] = await db
    .select({
      practiceName: practices.practiceName,
      practiceAddress: practices.address,
    })
    .from(practices)
    .where(eq(practices.practiceId, context.practiceId))
    .limit(1)

  if (!practitioner || !practice) {
    notFound()
  }

  const [fundingApprovals, reportTypes] = await Promise.all([
    getClientFundingApprovalsForReport(clientId, context.practiceId),
    getReportTypes(context.practiceId),
  ])

  const signatureDataUrl = practitioner.signatureImagePath
    ? await getSignatureAsDataUrl(practitioner.signatureImagePath)
    : null

  const [activePlan] = await db
    .select({ therapeuticTarget: treatmentPlans.therapeuticTarget })
    .from(treatmentPlans)
    .where(
      and(
        eq(treatmentPlans.clientId, clientId),
        eq(treatmentPlans.practiceId, context.practiceId),
        eq(treatmentPlans.isActive, true)
      )
    )
    .orderBy(desc(treatmentPlans.versionNumber))
    .limit(1)

  const therapeuticTarget = activePlan?.therapeuticTarget ?? null

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6 no-print">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
        <h1 className="text-2xl font-semibold tracking-tight">Create report</h1>
        <p className="mt-1 text-muted-foreground">{clientName}</p>
      </div>

      <ReportForm
        clientId={clientId}
        fundingApprovals={fundingApprovals}
        reportTypes={reportTypes}
        initialFundingApprovalId={initialFundingApprovalId ?? null}
        initialRequirementId={initialRequirementId ?? null}
        initialSnapshot={{
          client: {
            firstName: client.firstName,
            lastName: client.lastName,
            dateOfBirth: client.dateOfBirth,
          },
          practitioner: {
            title: practitioner.title,
            fullName: formatPractitionerName(practitioner),
            displayName: formatPractitionerFormalName(practitioner),
            signatureDataUrl,
          },
          practice: {
            practiceName: practice.practiceName,
            practiceAddress: practice.practiceAddress ?? null,
          },
          recipient: null,
          fundingApproval: null,
          therapeuticTarget: null,
        }}
        existingDraftReportId={null}
        previousVersionId={null}
        therapeuticTarget={therapeuticTarget}
        cancelHref={returnTo ?? `/clients/${clientId}`}
      />
    </AppShell>
  )
}
