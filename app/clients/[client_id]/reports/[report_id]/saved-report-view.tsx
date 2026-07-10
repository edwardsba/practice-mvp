"use client"

import Link from "next/link"
import { useState } from "react"

import { ReportDocument } from "@/components/report/report-document"
import { AssessmentSummaryMethodologyNote } from "@/components/report/assessment-summary-methodology-note"
import { SendReportEmailModal } from "@/components/report/send-report-email-modal"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import type { ReportEmailVariables } from "@/lib/email/report-templates"
import { formatDisplayDate } from "@/lib/funding/format"
import type { ReportSnapshot } from "@/lib/reports/snapshot"
import type { ReportVersionSummary } from "@/lib/reports/version-history"
import { REPORT_STATUS_CONFIG } from "@/lib/status"

function formatVersionDate(value: Date) {
  return value.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function SavedReportView({
  clientId,
  reportId,
  reportStatus,
  versionNumber,
  isCurrentVersion,
  snapshot,
  useLegacyProgressBody = false,
  fundingApproval,
  reportingRequirement,
  versions,
  defaultSendTo,
  addressOptions,
  autoOpenSend = false,
  templateVariables,
}: {
  clientId: string
  reportId: string
  reportStatus: string
  versionNumber: number
  isCurrentVersion: boolean
  snapshot: ReportSnapshot
  useLegacyProgressBody?: boolean
  fundingApproval: { approvalTypeName: string; startDate: string | null } | null
  reportingRequirement: { appointmentNumber: number; reportType: string } | null
  versions: ReportVersionSummary[]
  defaultSendTo: string
  addressOptions: { label: string; value: string }[]
  autoOpenSend?: boolean
  templateVariables: ReportEmailVariables
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(autoOpenSend)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  const isFinalised = reportStatus === "finalised"
  const currentVersion = versions.find((v) => v.isCurrentVersion)

  return (
    <div className="space-y-6">
      <Card className="no-print">
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">
                Linked funding approval
              </dt>
              <dd className="font-medium">
                {fundingApproval ? (
                  <>
                    {fundingApproval.approvalTypeName}
                    {fundingApproval.startDate
                      ? ` — Started ${formatDisplayDate(fundingApproval.startDate)}`
                      : ""}
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Linked reporting requirement
              </dt>
              <dd className="font-medium">
                {reportingRequirement
                  ? `Session ${reportingRequirement.appointmentNumber} · ${reportingRequirement.reportType}`
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="mb-2 text-sm text-muted-foreground">
                Report status
              </dt>
              <dd className="flex flex-wrap items-center gap-3">
                <StatusBadge
                  status={isFinalised ? "finalised" : "draft"}
                  statusMap={REPORT_STATUS_CONFIG}
                />
                <span className="text-sm text-muted-foreground">
                  Version {versionNumber}
                  {isCurrentVersion ? " · Current" : " · Superseded"}
                </span>
                {!isFinalised ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/clients/${clientId}/reports/${reportId}/edit`}>
                      Continue editing
                    </Link>
                  </Button>
                ) : null}
                {isFinalised && isCurrentVersion ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/clients/${clientId}/reports/${reportId}/edit`}>
                      Edit / Create new version
                    </Link>
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/reports/${reportId}/pdf`} download>
                    Download PDF
                  </a>
                </Button>
                {isFinalised && defaultSendTo ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setEmailModalOpen(true)}
                  >
                    Send Report
                  </Button>
                ) : isFinalised ? (
                  <Button type="button" size="sm" disabled title="No recipient address on file">
                    Send Report
                  </Button>
                ) : null}
              </dd>
            </div>
          </dl>

          {!isCurrentVersion && currentVersion ? (
            <p className="mt-4 text-sm text-muted-foreground">
              This version has been superseded.{" "}
              <Link
                href={`/clients/${clientId}/reports/${currentVersion.simpleReportId}`}
                className="text-primary hover:underline"
              >
                View the current version →
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <AssessmentSummaryMethodologyNote />

      {emailStatus ? (
        <p className="no-print text-sm font-medium text-foreground">{emailStatus}</p>
      ) : null}

      {defaultSendTo ? (
        <SendReportEmailModal
          open={emailModalOpen}
          onOpenChange={setEmailModalOpen}
          reportId={reportId}
          defaultTo={defaultSendTo}
          addressOptions={addressOptions}
          templateVariables={templateVariables}
          onSendComplete={({ sent }) => {
            setEmailStatus(
              sent
                ? `Email sent to ${defaultSendTo}`
                : "Email failed — try Download PDF and send manually."
            )
          }}
        />
      ) : null}

      <div id="report-print-area" className="report-print-area">
        <ReportDocument
          snapshot={snapshot}
          readOnly
          omitEmptySections
          useLegacyProgressBody={useLegacyProgressBody}
        />
      </div>

      {versions.length > 1 ? (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Version history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {versions.map((version) => (
                <li key={version.simpleReportId}>
                  <Link
                    href={`/clients/${clientId}/reports/${version.simpleReportId}`}
                    className={`text-sm hover:underline ${
                      version.isCurrentVersion
                        ? "font-semibold text-primary"
                        : "text-primary"
                    }`}
                  >
                    Version {version.versionNumber} —{" "}
                    {formatVersionDate(version.createdAt)}
                    {version.reportStatus !== "finalised" ? " (draft)" : ""}
                    {version.isCurrentVersion ? (
                      <span className="ml-2 font-medium text-foreground">
                        (Current)
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
