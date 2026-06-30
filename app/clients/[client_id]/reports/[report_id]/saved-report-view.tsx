"use client"

import Link from "next/link"
import { useActionState } from "react"

import { finaliseReport, type FinaliseReportState } from "@/app/clients/[client_id]/reports/[report_id]/actions"
import { ReportDocument } from "@/components/report/report-document"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/status-badge"
import { formatDisplayDate } from "@/lib/funding/format"
import type { ReportSnapshot } from "@/lib/reports/snapshot"
import { REPORT_STATUS_CONFIG } from "@/lib/status"

const initialState: FinaliseReportState = {}

export function SavedReportView({
  clientId,
  reportId,
  reportStatus,
  snapshot,
  fundingApproval,
  reportingRequirement,
}: {
  clientId: string
  reportId: string
  reportStatus: string
  snapshot: ReportSnapshot
  fundingApproval: { approvalTypeName: string; startDate: string | null } | null
  reportingRequirement: { appointmentNumber: number; reportType: string } | null
}) {
  const [state, formAction, pending] = useActionState(
    finaliseReport.bind(null, clientId, reportId),
    initialState
  )

  const isFinalised = reportStatus === "finalised" || state.success

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
                {!isFinalised ? (
                  <form action={formAction}>
                    <Button type="submit" size="sm" disabled={pending}>
                      {pending ? "Finalising…" : "Finalise"}
                    </Button>
                  </form>
                ) : null}
                {!isFinalised ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/clients/${clientId}/reports/${reportId}/edit`}>
                      Edit Report
                    </Link>
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/reports/${reportId}/pdf`} download>
                    Download PDF
                  </a>
                </Button>
              </dd>
            </div>
          </dl>
          {state.error ? (
            <p className="mt-3 text-sm text-destructive">{state.error}</p>
          ) : null}
        </CardContent>
      </Card>

      <div id="report-print-area" className="report-print-area">
        <ReportDocument snapshot={snapshot} readOnly omitEmptySections />
      </div>
    </div>
  )
}
