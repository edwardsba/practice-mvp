"use client"

import { useEffect, useRef, useState } from "react"

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
  buildResolvedEmailBodies,
  EMAIL_TEMPLATE_VARIABLE_CHIPS,
  getDefaultEmailDraft,
  type QuestionnaireEmailTemplateVariables,
} from "@/lib/email/templates"

export function SendEmailModal({
  open,
  onOpenChange,
  to,
  linkUrl,
  assessmentAccessLinkId,
  templateVariables,
  onSendComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  to: string
  linkUrl: string
  assessmentAccessLinkId: string
  templateVariables: QuestionnaireEmailTemplateVariables
  onSendComplete: (result: { sent: boolean }) => void
}) {
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    const draft = getDefaultEmailDraft(templateVariables)
    setSubject(draft.subject)
    setMessage(draft.message)
    setSendError(null)
    setSending(false)
  }, [open, templateVariables])

  function insertVariable(variable: string) {
    const el = messageRef.current
    if (!el) {
      setMessage((current) => current + variable)
      return
    }

    const start = el.selectionStart ?? message.length
    const end = el.selectionEnd ?? message.length
    const next = message.slice(0, start) + variable + message.slice(end)
    setMessage(next)

    requestAnimationFrame(() => {
      el.focus()
      const position = start + variable.length
      el.setSelectionRange(position, position)
    })
  }

  async function handleSend() {
    setSending(true)
    setSendError(null)

    const { subject: resolvedSubject, htmlBody, textBody } = buildResolvedEmailBodies(
      message,
      subject,
      linkUrl,
      templateVariables
    )

    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject: resolvedSubject,
          htmlBody,
          textBody,
          assessmentAccessLinkId,
        }),
      })

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
          <DialogTitle>Send questionnaire email</DialogTitle>
          <DialogDescription>
            Review and edit the email before sending. Changes are not saved for next
            time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email_to">To</Label>
            <Input
              id="email_to"
              type="email"
              value={to}
              readOnly
              disabled
              className="bg-muted text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_subject">Subject</Label>
            <Input
              id="email_subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_message">Message</Label>
            <Textarea
              id="email_message"
              ref={messageRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="font-sans text-sm"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Insert variable</p>
            <div className="flex flex-wrap gap-2">
              {EMAIL_TEMPLATE_VARIABLE_CHIPS.map((chip) => (
                <Button
                  key={chip.variable}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable(chip.variable)}
                >
                  {chip.label}
                </Button>
              ))}
            </div>
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
