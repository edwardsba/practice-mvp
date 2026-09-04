"use client"

import { useState } from "react"

import { SendReportEmailModal } from "@/components/report/send-report-email-modal"
import { Button } from "@/components/ui/button"
import type { ReportEmailVariables } from "@/lib/email/report-templates"

export function SageSrReportActionsToolbar({
  reportId,
  templateVariables,
}: {
  reportId: string
  templateVariables: ReportEmailVariables
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/sage-sr-diagnostic-reports/${reportId}/pdf`} download>
            Download PDF
          </a>
        </Button>
        <Button type="button" size="sm" onClick={() => setEmailModalOpen(true)}>
          Send Report
        </Button>
      </div>

      {emailStatus ? (
        <p className="text-sm font-medium text-foreground">{emailStatus}</p>
      ) : null}

      <SendReportEmailModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        reportId={reportId}
        defaultTo=""
        addressOptions={[]}
        templateVariables={templateVariables}
        sendEndpoint={`/api/sage-sr-diagnostic-reports/${reportId}/send-email`}
        onSendComplete={({ sent }) => {
          setEmailStatus(
            sent
              ? "Email sent."
              : "Email failed — try Download PDF and send manually."
          )
        }}
      />
    </div>
  )
}
