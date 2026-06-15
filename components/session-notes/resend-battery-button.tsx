"use client"

import { useState, useTransition } from "react"

import { resendPreSessionBattery } from "@/app/session-notes/actions"
import { Button } from "@/components/ui/button"

export function ResendBatteryButton({ appointmentId }: { appointmentId: string }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setMessage(null)
          startTransition(async () => {
            const result = await resendPreSessionBattery(appointmentId)
            if (result.status === "sent") {
              setIsError(false)
              setMessage("Questionnaire email sent.")
            } else if (result.status === "skipped") {
              setIsError(true)
              setMessage(
                result.reason === "opted_out"
                  ? "Not sent — this client has opted out of pre-session questionnaires."
                  : "Not sent — this client has no email address on file."
              )
            } else {
              setIsError(true)
              setMessage(result.error)
            }
          })
        }}
      >
        {pending ? "Sending…" : "Resend questionnaire"}
      </Button>
      {message ? (
        <span className={isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message}
        </span>
      ) : null}
    </div>
  )
}
