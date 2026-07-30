"use client"

import { useState } from "react"

import { SendTreatmentPlanEmailModal } from "@/components/treatment-plan/send-treatment-plan-email-modal"
import { Button } from "@/components/ui/button"
import type { TreatmentPlanEmailVariables } from "@/lib/email/treatment-plan-templates"

export function TreatmentPlanToolbar({
  treatmentPlanId,
  clientEmail,
  templateVariables,
  autoOpenSend = false,
}: {
  treatmentPlanId: string
  clientEmail: string | null
  templateVariables: TreatmentPlanEmailVariables
  autoOpenSend?: boolean
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(autoOpenSend)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" asChild>
          <a href={`/api/treatment-plans/${treatmentPlanId}/pdf`} download>
            Download PDF
          </a>
        </Button>
        {clientEmail ? (
          <Button type="button" onClick={() => setEmailModalOpen(true)}>
            Send to Client
          </Button>
        ) : (
          <Button type="button" disabled title="No email on file">
            Send to Client
          </Button>
        )}
      </div>

      {emailStatus ? (
        <p className="text-sm font-medium text-foreground">{emailStatus}</p>
      ) : null}

      {clientEmail ? (
        <SendTreatmentPlanEmailModal
          open={emailModalOpen}
          onOpenChange={setEmailModalOpen}
          to={clientEmail}
          treatmentPlanId={treatmentPlanId}
          templateVariables={templateVariables}
          onSendComplete={({ sent }) => {
            setEmailStatus(
              sent
                ? `Email sent to ${clientEmail}`
                : "Email failed — try Download PDF and send manually."
            )
          }}
        />
      ) : null}
    </div>
  )
}
