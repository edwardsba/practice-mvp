"use client"

import { useEffect, useState } from "react"

import { SendEmailModal } from "@/components/email/send-email-modal"
import { Button } from "@/components/ui/button"
import type { BatteryAssessmentChip } from "@/lib/assessments/battery-defaults"
import type { QuestionnaireEmailTemplateVariables } from "@/lib/email/templates"

export function SendBatteryButton({
  clientId,
  practitionerProfileId,
  clientEmail,
  templateVariables,
  defaultAssessments,
}: {
  clientId: string
  practitionerProfileId: string
  clientEmail: string | null
  templateVariables: QuestionnaireEmailTemplateVariables
  defaultAssessments: BatteryAssessmentChip[]
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!statusMessage) return
    const timer = window.setTimeout(() => setStatusMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  function handleClick() {
    if (!clientEmail) {
      setStatusMessage("No email on file")
      return
    }
    setModalOpen(true)
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={handleClick} size="lg">
        Send Pre-Session Questionnaire
      </Button>

      {statusMessage ? (
        <p className="text-sm text-muted-foreground" role="status">
          {statusMessage}
        </p>
      ) : null}

      {clientEmail ? (
        <SendEmailModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          to={clientEmail}
          templateVariables={templateVariables}
          clientId={clientId}
          practitionerProfileId={practitionerProfileId}
          mode="battery"
          assessments={defaultAssessments}
          onSendComplete={({ sent, email }) => {
            if (sent) {
              setStatusMessage(`Email sent to ${email}`)
            }
          }}
        />
      ) : null}
    </div>
  )
}
