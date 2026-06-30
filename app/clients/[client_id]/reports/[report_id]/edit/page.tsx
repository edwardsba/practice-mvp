import { notFound, redirect } from "next/navigation"
import { and, desc, eq } from "drizzle-orm"

import { ReportForm } from "@/app/clients/[client_id]/reports/new/report-form"
import {
  deleteSimpleReport,
  updateReportDraft,
} from "@/app/clients/[client_id]/reports/[report_id]/edit/actions"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityDeleteSection } from "@/components/entity-delete-section"
import {
  clients,
  practitionerProfiles,
  practices,
  simpleReports,
  treatmentPlans,
} from "@/db/schema"
import { getClientFundingApprovalsForReport } from "@/lib/actions/funding"
import { getReportTypes } from "@/lib/actions/report-types"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseReportSnapshot } from "@/lib/reports/snapshot"
import {
  formatPractitionerFormalName,
  formatPractitionerName,
} from "@/lib/practitioner/format"
import { getSignatureAsDataUrl } from "@/lib/practitioner/signature"

import "@/components/report/report-print.css"

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ client_id: string; report_id: string }>
}) {
  const { client_id: clientId, report_id: reportId } = await params
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
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

  const [report] = await db
    .select({
      reportStatus: simpleReports.reportStatus,
      valuesSnapshotJson: simpleReports.valuesSnapshotJson,
      reportTypeId: simpleReports.reportTypeId,
      fundingApprovalId: simpleReports.fundingApprovalId,
      reportRequirementId: simpleReports.reportRequirementId,
      recipientType: simpleReports.recipientType,
      reportDate: simpleReports.reportDate,
      dateRangeStart: simpleReports.dateRangeStart,
      dateRangeEnd: simpleReports.dateRangeEnd,
      clinicalSummaryText: simpleReports.clinicalSummaryText,
      recommendationsText: simpleReports.recommendationsText,
    })
    .from(simpleReports)
    .where(
      and(
        eq(simpleReports.simpleReportId, reportId),
        eq(simpleReports.clientId, clientId),
        eq(simpleReports.practiceId, context.practiceId)
      )
    )
    .limit(1)

  if (!report) {
    notFound()
  }

  if (report.reportStatus === "finalised") {
    redirect(`/clients/${clientId}/reports/${reportId}`)
  }

  const snapshot = parseReportSnapshot(report.valuesSnapshotJson)
  if (!snapshot) {
    notFound()
  }

  const [fundingApprovals, reportTypes, practitioner, practice] =
    await Promise.all([
      getClientFundingApprovalsForReport(clientId, context.practiceId),
      getReportTypes(context.practiceId),
      db
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
          eq(
            practitionerProfiles.practitionerProfileId,
            context.practitionerProfileId
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          practiceName: practices.practiceName,
          practiceAddress: practices.address,
        })
        .from(practices)
        .where(eq(practices.practiceId, context.practiceId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ])

  if (!practitioner || !practice) {
    notFound()
  }

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
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}/reports/${reportId}`}
          label="← Back to report"
        />
        <h1 className="text-2xl font-semibold tracking-tight">Edit report</h1>
        <p className="mt-1 text-muted-foreground">{clientName}</p>
      </div>

      <ReportForm
        clientId={clientId}
        fundingApprovals={fundingApprovals}
        reportTypes={reportTypes}
        initialFundingApprovalId={report.fundingApprovalId ?? null}
        initialRequirementId={report.reportRequirementId ?? null}
        initialReportTypeId={report.reportTypeId ?? null}
        initialReportDate={
          report.reportDate ? String(report.reportDate) : undefined
        }
        initialRecipientType={report.recipientType ?? "client"}
        initialSelectedAppointmentIds={snapshot.selectedAppointmentIds ?? []}
        initialDateRangeStart={
          report.dateRangeStart ? String(report.dateRangeStart) : undefined
        }
        initialDateRangeEnd={
          report.dateRangeEnd ? String(report.dateRangeEnd) : undefined
        }
        initialClinicalSummary={report.clinicalSummaryText ?? ""}
        initialRecommendations={report.recommendationsText ?? ""}
        initialSnapshot={{
          client: snapshot.client,
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
          recipient: snapshot.recipient,
          fundingApproval: snapshot.fundingApproval,
          therapeuticTarget: snapshot.therapeuticTarget ?? null,
        }}
        saveAction={updateReportDraft.bind(null, clientId, reportId)}
        submitLabel="Save changes"
        therapeuticTarget={therapeuticTarget}
        cancelHref={`/clients/${clientId}/reports/${reportId}`}
      />

      <EntityDeleteSection
        entityName="Report"
        deleteAction={deleteSimpleReport.bind(
          null,
          reportId,
          context.practiceId
        )}
      />
    </AppShell>
  )
}
