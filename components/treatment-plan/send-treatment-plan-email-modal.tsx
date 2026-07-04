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
import {
  DEFAULT_TREATMENT_PLAN_MESSAGE,
  DEFAULT_TREATMENT_PLAN_SUBJECT,
  getDefaultTreatmentPlanEmailDraft,
  type TreatmentPlanEmailVariables,
} from "@/lib/email/treatment-plan-templates"
import { resolveTemplate } from "@/lib/email/templates"

export function SendTreatmentPlanEmailModal({
  open,
  onOpenChange,
  to,
  treatmentPlanId,
  templateVariables,
  onSendComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  to: string
  treatmentPlanId: string
  templateVariables: TreatmentPlanEmailVariables
  onSendComplete: (result: { sent: boolean }) => void
}) {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSendError(null)
    setSending(false)

    fetch("/api/email/template?key=treatment_plan")
      .then((r) => r.json())
      .then((data: { subject?: string; message?: string }) => {
        const vars = templateVariables
        const subject = resolveTemplate(
          data.subject ?? DEFAULT_TREATMENT_PLAN_SUBJECT,
          vars
        )
        const message = resolveTemplate(
          data.message ?? DEFAULT_TREATMENT_PLAN_MESSAGE,
          vars
        )
        setSubject(subject)
        setMessage(message)
      })
      .catch(() => {
        const draft = getDefaultTreatmentPlanEmailDraft(templateVariables)
        setSubject(draft.subject)
        setMessage(draft.message)
      })
  }, [open, templateVariables])

  async function handleSend() {
    setSending(true)
    setSendError(null)

    try {
      const response = await fetch(
        `/api/treatment-plans/${treatmentPlanId}/send-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, message }),
        }
      )

      const data = (await response.json()) as { sent?: boolean; error?: string }

      if (!response.ok || !data.sent) {
        setSendError(data.error ?? "Unable to send email.")
        onSendComplete({ sent: false })
        return
      }

      onOpenChange(false)
      onSendComplete({ sent: true })
    } catch {
      setSendError("Unable to send email.")
      onSendComplete({ sent: false })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send treatment plan to client</DialogTitle>
          <DialogDescription>
            Review and edit the email before sending. A PDF of the treatment
            plan will be attached.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="treatment_plan_email_to">To</Label>
            <Input
              id="treatment_plan_email_to"
              type="email"
              value={to}
              readOnly
              disabled
              className="bg-muted text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatment_plan_email_subject">Subject</Label>
            <Input
              id="treatment_plan_email_subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatment_plan_email_message">Message</Label>
            <Textarea
              id="treatment_plan_email_message"
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

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
