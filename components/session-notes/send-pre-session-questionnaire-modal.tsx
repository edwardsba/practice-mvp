"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type PrepareResult =
  | {
      status: "ready"
      to: string
      subject: string
      message: string
    }
  | { status: "skipped"; reason: "opted_out" | "no_email" }
  | { status: "failed"; error: string }

function skipMessage(reason: "opted_out" | "no_email") {
  if (reason === "opted_out") {
    return "Not sent — this client has opted out of pre-session questionnaires."
  }
  return "Not sent — this client has no email address on file."
}

export function SendPreSessionQuestionnaireModal({
  open,
  onOpenChange,
  appointmentId,
  onSendComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointmentId: string
  onSendComplete: (result: {
    sent: boolean
    skipped?: boolean
    reason?: "opted_out" | "no_email"
    error?: string
  }) => void
}) {
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [skipReason, setSkipReason] = useState<"opted_out" | "no_email" | null>(
    null
  )
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setLoading(true)
    setLoadError(null)
    setSkipReason(null)
    setSendError(null)
    setSending(false)
    setTo("")
    setSubject("")
    setMessage("")

    fetch("/api/session-notes/battery-email/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId }),
    })
      .then((response) => response.json())
      .then((data: PrepareResult & { error?: string }) => {
        if (data.status === "ready") {
          setTo(data.to)
          setSubject(data.subject)
          setMessage(data.message)
          return
        }

        if (data.status === "skipped") {
          setSkipReason(data.reason)
          return
        }

        if (data.status === "failed") {
          setLoadError(data.error)
          return
        }

        setLoadError("Unable to prepare email.")
      })
      .catch(() => {
        setLoadError("Unable to prepare email.")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [open, appointmentId])

  async function handleSend() {
    setSending(true)
    setSendError(null)

    try {
      const response = await fetch("/api/session-notes/battery-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, subject, message }),
      })

      const data = (await response.json()) as {
        sent?: boolean
        skipped?: boolean
        reason?: "opted_out" | "no_email"
        error?: string
      }

      if (data.skipped && data.reason) {
        onOpenChange(false)
        onSendComplete({ sent: false, skipped: true, reason: data.reason })
        return
      }

      if (!response.ok || !data.sent) {
        const error = data.error ?? "Unable to send email."
        setSendError(error)
        onSendComplete({ sent: false, error })
        return
      }

      onOpenChange(false)
      onSendComplete({ sent: true })
    } catch {
      setSendError("Unable to send email.")
      onSendComplete({ sent: false, error: "Unable to send email." })
    } finally {
      setSending(false)
    }
  }

  const canSend = !loading && !loadError && !skipReason && Boolean(to)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send pre-session questionnaire</DialogTitle>
          <DialogDescription>
            Review and edit the email before sending. A unique questionnaire link
            will be created when you send.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading email…</p>
        ) : skipReason ? (
          <p className="text-sm text-destructive" role="alert">
            {skipMessage(skipReason)}
          </p>
        ) : loadError ? (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="battery_email_to">To</Label>
              <Input
                id="battery_email_to"
                type="email"
                value={to}
                readOnly
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="battery_email_subject">Subject</Label>
              <Input
                id="battery_email_subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="battery_email_message">Message</Label>
              <Textarea
                id="battery_email_message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                className="font-sans text-sm"
              />
            </div>

            {sendError ? (
              <p className="text-sm text-destructive" role="alert">
                {sendError}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          {canSend ? (
            <Button type="button" onClick={handleSend} disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
