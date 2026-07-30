"use client"

import { useState } from "react"

import { SendCrisisPlanEmailModal } from "@/components/crisis-plan/send-crisis-plan-email-modal"
import { Button } from "@/components/ui/button"
import type { CrisisPlanEmailVariables } from "@/lib/email/crisis-plan-templates"

export function CrisisPlanToolbar({
  crisisPlanId,
  clientEmail,
  templateVariables,
  autoOpenSend = false,
}: {
  crisisPlanId: string
  clientEmail: string | null
  templateVariables: CrisisPlanEmailVariables
  autoOpenSend?: boolean
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(autoOpenSend)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" asChild>
          <a href={`/api/crisis-plan/${crisisPlanId}/pdf`} download>
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
        <SendCrisisPlanEmailModal
          open={emailModalOpen}
          onOpenChange={setEmailModalOpen}
          to={clientEmail}
          crisisPlanId={crisisPlanId}
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
