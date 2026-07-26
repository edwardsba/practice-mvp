"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { SendPreSessionQuestionnaireModal } from "@/components/session-notes/send-pre-session-questionnaire-modal"

export function PreSessionBatteryStatus({
  appointmentId,
  sentAtLabel,
  autoOpen = false,
}: {
  appointmentId: string
  sentAtLabel: string | null
  autoOpen?: boolean
}) {
  const [modalOpen, setModalOpen] = useState(autoOpen)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  return (
    <div className="space-y-1">
      <p className="font-medium">
        {sentAtLabel ?? "Pre-session battery not yet sent"}
      </p>
      {!sentAtLabel ? (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMessage(null)
              setModalOpen(true)
            }}
          >
            Send pre-session questionnaire
          </Button>
          {message ? (
            <span
              className={
                isError
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {message}
            </span>
          ) : null}
        </div>
      ) : null}

      <SendPreSessionQuestionnaireModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        appointmentId={appointmentId}
        onSendComplete={(result) => {
          if (result.sent) {
            setIsError(false)
            setMessage("Questionnaire email sent.")
          } else if (result.skipped && result.reason) {
            setIsError(true)
            setMessage(
              result.reason === "opted_out"
                ? "Not sent — this client has opted out of pre-session questionnaires."
                : "Not sent — this client has no email address on file."
            )
          } else {
            setIsError(true)
            setMessage(result.error ?? "Unable to send email.")
          }
        }}
      />
    </div>
  )
}
