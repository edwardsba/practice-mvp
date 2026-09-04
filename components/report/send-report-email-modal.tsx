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
  DEFAULT_REPORT_MESSAGE,
  DEFAULT_REPORT_SUBJECT,
  getDefaultReportEmailDraft,
  type ReportEmailVariables,
} from "@/lib/email/report-templates"
import { resolveTemplate } from "@/lib/email/templates"

export type ReferrerEmailAddressOption = {
  label: string
  value: string
}

export function SendReportEmailModal({
  open,
  onOpenChange,
  reportId,
  defaultTo,
  addressOptions,
  templateVariables,
  sendEndpoint,
  onSendComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportId: string
  defaultTo: string
  addressOptions: ReferrerEmailAddressOption[]
  templateVariables: ReportEmailVariables
  sendEndpoint?: string
  onSendComplete: (result: { sent: boolean }) => void
}) {
  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTo(defaultTo)
    setSendError(null)
    setSending(false)

    fetch("/api/email/template?key=report")
      .then((r) => r.json())
      .then((data: { subject?: string; message?: string }) => {
        setSubject(
          resolveTemplate(data.subject ?? DEFAULT_REPORT_SUBJECT, templateVariables)
        )
        setMessage(
          resolveTemplate(data.message ?? DEFAULT_REPORT_MESSAGE, templateVariables)
        )
      })
      .catch(() => {
        const draft = getDefaultReportEmailDraft(templateVariables)
        setSubject(draft.subject)
        setMessage(draft.message)
      })
  }, [open, defaultTo, templateVariables])

  async function handleSend() {
    setSending(true)
    setSendError(null)

    try {
      const response = await fetch(
        sendEndpoint ?? `/api/reports/${reportId}/send-email`,
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
          <DialogTitle>Send report</DialogTitle>
          <DialogDescription>
            Review and edit the email before sending. A PDF of the report will be
            attached.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {addressOptions.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="report_email_address_picker">
                Known clinic addresses
              </Label>
              <select
                id="report_email_address_picker"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value=""
                onChange={(e) => {
                  if (e.target.value) setTo(e.target.value)
                }}
              >
                <option value="">Choose a different address…</option>
                {addressOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label} — {option.value}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="report_email_to">To</Label>
            <Input
              id="report_email_to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report_email_subject">Subject</Label>
            <Input
              id="report_email_subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report_email_message">Message</Label>
            <Textarea
              id="report_email_message"
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
          <Button type="button" onClick={handleSend} disabled={sending || !to}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
