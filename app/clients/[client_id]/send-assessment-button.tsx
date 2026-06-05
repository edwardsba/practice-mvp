"use client"

import { useEffect, useState } from "react"

import { SendEmailModal } from "@/components/email/send-email-modal"
import { Button } from "@/components/ui/button"
import type { QuestionnaireEmailTemplateVariables } from "@/lib/email/templates"

export function SendAssessmentButton({
  clientId,
  practitionerProfileId,
  assessmentCode,
  buttonLabel,
  clientEmail,
  templateVariables,
  compact = false,
}: {
  clientId: string
  practitionerProfileId: string
  assessmentCode: string
  buttonLabel: string
  clientEmail: string | null
  templateVariables: QuestionnaireEmailTemplateVariables
  compact?: boolean
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
    <div
      className={
        compact
          ? "flex w-full min-w-[200px] flex-1 flex-col gap-2"
          : "flex w-full max-w-xl flex-col items-end gap-2"
      }
    >
      <Button
        type="button"
        variant={compact ? "outline" : "default"}
        size={compact ? "sm" : "default"}
        onClick={handleClick}
        className={compact ? "w-full" : undefined}
      >
        {buttonLabel}
      </Button>

      {statusMessage ? (
        <p
          className={`w-full text-sm text-muted-foreground ${compact ? "" : "text-right"}`}
          role="status"
        >
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
          mode="individual"
          assessmentCode={assessmentCode}
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
