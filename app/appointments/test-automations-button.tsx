"use client"

import { useState, useTransition } from "react"

import { testAppointmentAutomations } from "@/app/appointments/actions"
import { Button } from "@/components/ui/button"

export function TestAutomationsButton() {
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    setMessage(null)
    startTransition(async () => {
      const result = await testAppointmentAutomations()
      if (result.error) {
        setMessage(result.error)
        return
      }

      if (result.result) {
        const errorSummary =
          result.result.errors.length > 0
            ? ` Errors: ${result.result.errors.join(" ")}`
            : ""
        setMessage(
          `Reminders sent: ${result.result.reminders_sent}. Batteries sent: ${result.result.batteries_sent}.${errorSummary}`
        )
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={pending}
      >
        {pending ? "Running…" : "Test automations"}
      </Button>
      {message ? (
        <p className="max-w-md text-right text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
