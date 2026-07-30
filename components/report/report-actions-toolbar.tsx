"use client"

import { useState } from "react"

import { SendReportEmailModal } from "@/components/report/send-report-email-modal"
import { Button } from "@/components/ui/button"
import type { ReportEmailVariables } from "@/lib/email/report-templates"

export function ReportActionsToolbar({
  reportId,
  isFinalised,
  defaultSendTo,
  addressOptions,
  autoOpenSend = false,
  templateVariables,
}: {
  reportId: string
  isFinalised: boolean
  defaultSendTo: string
  addressOptions: { label: string; value: string }[]
  autoOpenSend?: boolean
  templateVariables: ReportEmailVariables
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(autoOpenSend)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
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
          <Button
            type="button"
            size="sm"
            disabled
            title="No recipient address on file"
          >
            Send Report
          </Button>
        ) : null}
      </div>

      {emailStatus ? (
        <p className="text-sm font-medium text-foreground">{emailStatus}</p>
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
    </div>
  )
}
