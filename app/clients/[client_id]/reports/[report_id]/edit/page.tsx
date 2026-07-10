import { notFound } from "next/navigation"
import { and, desc, eq } from "drizzle-orm"

import { ReportForm } from "@/app/clients/[client_id]/reports/new/report-form"
import { deleteReportDraft } from "@/app/clients/[client_id]/reports/[report_id]/edit/actions"
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
import { parseLetterBodyJson } from "@/lib/reports/letter-body-types"
import { loadActiveCrisisPlanSummary } from "@/lib/crisis-plans/load"
import { suicideAttemptItemsFromJson } from "@/lib/treatment-plans/serialize"
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
      versionNumber: simpleReports.versionNumber,
      previousVersionId: simpleReports.previousVersionId,
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
      letterBodyJson: simpleReports.letterBodyJson,
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

  const snapshot = parseReportSnapshot(report.valuesSnapshotJson)
  if (!snapshot) {
    notFound()
  }

  const initialLetterBodyJson = parseLetterBodyJson(report.letterBodyJson)
  const snapshotForForm = initialLetterBodyJson
    ? { ...snapshot, letterBodyJson: initialLetterBodyJson }
    : snapshot

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

  const [activePlan, activeCrisisPlan] = await Promise.all([
    db
      .select({
        therapeuticTarget: treatmentPlans.therapeuticTarget,
        behaviouralTargetsJson: treatmentPlans.behaviouralTargetsJson,
        ongoingAssessmentsJson: treatmentPlans.ongoingAssessmentsJson,
        suicideAttemptsJson: treatmentPlans.suicideAttemptsJson,
      })
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
      .then((rows) => rows[0] ?? null),
    loadActiveCrisisPlanSummary(clientId, context.practiceId),
  ])

  const therapeuticTarget = activePlan?.therapeuticTarget ?? null
  const behaviouralTargets =
    (activePlan?.behaviouralTargetsJson as { items?: string[] } | null)?.items ?? []
  const assistEnabled =
    (activePlan?.ongoingAssessmentsJson as { assist?: boolean } | null)?.assist ?? false
  const suicideAttempts = suicideAttemptItemsFromJson(activePlan?.suicideAttemptsJson)
  const crisisPlanDate = activeCrisisPlan?.dateOfPlan ?? null

  const clientName = `${client.firstName} ${client.lastName}`
  const isFinalised = report.reportStatus === "finalised"
  const existingDraftReportId = isFinalised ? null : reportId
  const previousVersionId = isFinalised ? reportId : report.previousVersionId

  return (
    <AppShell>
      <div className="mb-6">
        <BackButton
          fallbackHref={`/clients/${clientId}/reports/${reportId}`}
          label="← Back to report"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          {isFinalised ? "Correct report" : "Edit report"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {clientName}
          {isFinalised
            ? " — saving creates a new version; the original stays on file."
            : ""}
        </p>
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
        initialLetterBodyJson={initialLetterBodyJson}
        initialSnapshot={{
          client: snapshotForForm.client,
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
          recipient: snapshotForForm.recipient,
          fundingApproval: snapshotForForm.fundingApproval,
          therapeuticTarget: snapshotForForm.therapeuticTarget ?? null,
          behaviouralTargets: snapshotForForm.behaviouralTargets ?? [],
          assistEnabled: snapshotForForm.assistEnabled ?? false,
          suicideAttempts: snapshotForForm.suicideAttempts ?? [],
          crisisPlanDate: snapshotForForm.crisisPlanDate ?? null,
        }}
        existingDraftReportId={existingDraftReportId}
        previousVersionId={previousVersionId}
        therapeuticTarget={therapeuticTarget}
        behaviouralTargets={behaviouralTargets}
        assistEnabled={assistEnabled}
        suicideAttempts={suicideAttempts}
        crisisPlanDate={crisisPlanDate}
        cancelHref={`/clients/${clientId}/reports/${reportId}`}
      />

      {!isFinalised ? (
        <EntityDeleteSection
          entityName="Report draft"
          deleteAction={deleteReportDraft.bind(
            null,
            reportId,
            context.practiceId
          )}
        />
      ) : null}
    </AppShell>
  )
}
