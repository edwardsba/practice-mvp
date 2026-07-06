import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"

import { SavedReportView } from "@/app/clients/[client_id]/reports/[report_id]/saved-report-view"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import {
  clients,
  fundingApprovalTypeReports,
  fundingApprovalTypes,
  fundingApprovals,
  simpleReports,
} from "@/db/schema"
import { requirePractitionerContext } from "@/lib/auth"
import { db } from "@/lib/db"
import { getQuestionnaireEmailContext } from "@/lib/email/practitioner-context"
import { parseReportSnapshot } from "@/lib/reports/snapshot"
import { getReferrerEmailOptions } from "@/lib/reports/referrer-contact"
import { loadReportVersionHistory } from "@/lib/reports/version-history"

import "@/components/report/report-print.css"

export default async function SavedReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ client_id: string; report_id: string }>
  searchParams: Promise<{ openSend?: string }>
}) {
  const { client_id: clientId, report_id: reportId } = await params
  const { openSend } = await searchParams
  const context = await requirePractitionerContext()

  const [client] = await db
    .select({
      firstName: clients.firstName,
      lastName: clients.lastName,
      email: clients.email,
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
      simpleReportId: simpleReports.simpleReportId,
      reportStatus: simpleReports.reportStatus,
      versionNumber: simpleReports.versionNumber,
      isCurrentVersion: simpleReports.isCurrentVersion,
      valuesSnapshotJson: simpleReports.valuesSnapshotJson,
      fundingApprovalId: simpleReports.fundingApprovalId,
      reportRequirementId: simpleReports.reportRequirementId,
      recipientType: simpleReports.recipientType,
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

  let fundingApproval: {
    approvalTypeName: string
    startDate: string | null
  } | null = null

  if (report.fundingApprovalId) {
    const [fa] = await db
      .select({
        approvalTypeName: fundingApprovalTypes.name,
        startDate: fundingApprovals.startDate,
      })
      .from(fundingApprovals)
      .leftJoin(
        fundingApprovalTypes,
        eq(
          fundingApprovals.fundingApprovalTypeId,
          fundingApprovalTypes.fundingApprovalTypeId
        )
      )
      .where(
        and(
          eq(fundingApprovals.fundingApprovalId, report.fundingApprovalId),
          eq(fundingApprovals.practiceId, context.practiceId)
        )
      )
      .limit(1)

    if (fa) {
      fundingApproval = {
        approvalTypeName: fa.approvalTypeName ?? "Funding approval",
        startDate: fa.startDate,
      }
    }
  }

  let reportingRequirement: {
    appointmentNumber: number
    reportType: string
  } | null = null

  if (report.reportRequirementId) {
    const [req] = await db
      .select({
        appointmentNumber: fundingApprovalTypeReports.appointmentNumber,
        reportType: fundingApprovalTypeReports.reportType,
      })
      .from(fundingApprovalTypeReports)
      .where(
        eq(
          fundingApprovalTypeReports.reportRequirementId,
          report.reportRequirementId
        )
      )
      .limit(1)

    if (req) {
      reportingRequirement = req
    }
  }

  const versions = await loadReportVersionHistory(reportId, context.practiceId)

  const referrerOptions =
    report.recipientType === "referrer" && report.fundingApprovalId
      ? await getReferrerEmailOptions(report.fundingApprovalId, context.practiceId)
      : null

  const emailContext = await getQuestionnaireEmailContext(
    context.practiceId,
    context.practitionerProfileId
  )

  const addressOptions: { label: string; value: string }[] = []
  if (referrerOptions?.faxEmail) {
    addressOptions.push({ label: "Fax email", value: referrerOptions.faxEmail })
  }
  if (referrerOptions?.claimsEmail) {
    addressOptions.push({ label: "Claims email", value: referrerOptions.claimsEmail })
  }
  if (referrerOptions?.secureMessaging) {
    addressOptions.push({
      label: "Secure messaging",
      value: referrerOptions.secureMessaging,
    })
  }
  if (referrerOptions?.email) {
    addressOptions.push({ label: "General email", value: referrerOptions.email })
  }

  const defaultSendTo =
    report.recipientType === "client"
      ? client.email?.trim() || ""
      : addressOptions[0]?.value ?? ""

  return (
    <AppShell>
      <div className="mb-6 no-print">
        <BackButton
          fallbackHref={`/clients/${clientId}`}
          label="← Back to client"
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          {snapshot.reportTitle}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {client.lastName}, {client.firstName}
          {fundingApproval ? ` — ${fundingApproval.approvalTypeName}` : ""}
        </p>
      </div>

      <SavedReportView
        clientId={clientId}
        reportId={reportId}
        reportStatus={report.reportStatus}
        versionNumber={report.versionNumber}
        isCurrentVersion={report.isCurrentVersion}
        snapshot={snapshot}
        fundingApproval={fundingApproval}
        reportingRequirement={reportingRequirement}
        versions={versions}
        defaultSendTo={defaultSendTo}
        addressOptions={addressOptions}
        autoOpenSend={openSend === "1"}
        templateVariables={{
          recipient_name:
            report.recipientType === "referrer"
              ? snapshot.recipient?.name || "Colleague"
              : client.firstName.trim() || "there",
          client_name: `${client.firstName} ${client.lastName}`,
          report_title: snapshot.reportTitle,
          report_title_lower: snapshot.reportTitle.toLowerCase(),
          practice_name: emailContext?.practiceName ?? "your practice",
          practitioner_name: emailContext?.practitionerName ?? "your practitioner",
        }}
      />
    </AppShell>
  )
}
