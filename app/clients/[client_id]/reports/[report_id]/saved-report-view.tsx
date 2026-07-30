import Link from "next/link"

import { ReportDocument } from "@/components/report/report-document"
import { AssessmentSummaryMethodologyNote } from "@/components/report/assessment-summary-methodology-note"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDisplayDate } from "@/lib/funding/format"
import type { ReportSnapshot } from "@/lib/reports/snapshot"
import type { ReportVersionSummary } from "@/lib/reports/version-history"

function formatVersionDate(value: Date) {
  return value.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function SavedReportView({
  clientId,
  versionNumber,
  isCurrentVersion,
  snapshot,
  useLegacyProgressBody = false,
  fundingApproval,
  reportingRequirement,
  versions,
}: {
  clientId: string
  versionNumber: number
  isCurrentVersion: boolean
  snapshot: ReportSnapshot
  useLegacyProgressBody?: boolean
  fundingApproval: { approvalTypeName: string; startDate: string | null } | null
  reportingRequirement: { appointmentNumber: number; reportType: string } | null
  versions: ReportVersionSummary[]
}) {
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
              <dd className="text-sm text-muted-foreground">
                Version {versionNumber}
                {isCurrentVersion ? " · Current" : " · Superseded"}
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
