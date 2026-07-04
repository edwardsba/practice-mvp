"use client"

import Link from "next/link"
import { useState } from "react"

import { SendTreatmentPlanEmailModal } from "@/components/treatment-plan/send-treatment-plan-email-modal"
import { Button } from "@/components/ui/button"
import type { TreatmentPlanEmailVariables } from "@/lib/email/treatment-plan-templates"

export function TreatmentPlanToolbar({
  clientId,
  treatmentPlanId,
  isActive,
  clientEmail,
  templateVariables,
}: {
  clientId: string
  treatmentPlanId: string
  isActive: boolean
  clientEmail: string | null
  templateVariables: TreatmentPlanEmailVariables
}) {
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {isActive ? (
          <Button asChild variant="outline">
            <Link
              href={`/clients/${clientId}/treatment-plan/${treatmentPlanId}/edit`}
            >
              Edit / Create new version
            </Link>
          </Button>
        ) : null}
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
