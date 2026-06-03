"use client"

import { useActionState } from "react"

import { finaliseReport, type FinaliseReportState } from "@/app/clients/[client_id]/reports/[report_id]/actions"
import { ReportDocument } from "@/components/report/report-document"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ReportSnapshot } from "@/lib/reports/snapshot"

const initialState: FinaliseReportState = {}

export function SavedReportView({
  clientId,
  reportId,
  reportStatus,
  snapshot,
}: {
  clientId: string
  reportId: string
  reportStatus: string
  snapshot: ReportSnapshot
}) {
  const [state, formAction, pending] = useActionState(
    finaliseReport.bind(null, clientId, reportId),
    initialState
  )

  const isFinalised = reportStatus === "finalised" || state.success

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 no-print">
        {isFinalised ? (
          <Badge variant="success">Finalised</Badge>
        ) : (
          <form action={formAction}>
            <Button type="submit" disabled={pending}>
              {pending ? "Finalising…" : "Finalise"}
            </Button>
          </form>
        )}
        <Button type="button" variant="outline" onClick={handlePrint}>
          Print / Save as PDF
        </Button>
        {state.error ? (
          <p className="w-full text-sm text-destructive">{state.error}</p>
        ) : null}
      </div>

      <div id="report-print-area" className="report-print-area">
        <ReportDocument snapshot={snapshot} readOnly />
      </div>
    </div>
  )
}
