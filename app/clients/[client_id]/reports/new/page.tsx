import Link from "next/link"
import { notFound } from "next/navigation"
import { and, eq } from "drizzle-orm"

import { ReportForm } from "@/app/clients/[client_id]/reports/new/report-form"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { clients, practitionerProfiles, practices } from "@/db/schema"
import { getClientFundingApprovalsForReport } from "@/lib/actions/funding"
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
}: {
  params: Promise<{ client_id: string }>
}) {
  const { client_id: clientId } = await params
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

  const fundingApprovals = await getClientFundingApprovalsForReport(
    clientId,
    context.practiceId
  )

  const signatureDataUrl = practitioner.signatureImagePath
    ? await getSignatureAsDataUrl(practitioner.signatureImagePath)
    : null

  const clientName = `${client.firstName} ${client.lastName}`

  return (
    <AppShell>
      <div className="mb-6 no-print">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
        <h1 className="text-2xl font-semibold tracking-tight">{clientName}</h1>
        <p className="mt-1 text-muted-foreground">Create progress report</p>
      </div>

      <ReportForm
        clientId={clientId}
        fundingApprovals={fundingApprovals}
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
        }}
      />
    </AppShell>
  )
}
