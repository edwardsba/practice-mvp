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
  selectedBatteryCodes,
  type BatteryAssessmentChip,
} from "@/lib/assessments/battery-defaults"
import type { QuestionnaireLinkApiResponse } from "@/lib/email/link-response"
import {
  buildResolvedEmailBodies,
  EMAIL_TEMPLATE_VARIABLE_CHIPS,
  formatQuestionnaireExpiryDate,
  getDefaultEmailDraft,
  type QuestionnaireEmailTemplateVariables,
} from "@/lib/email/templates"
import { cn } from "@/lib/utils"

type AssessmentChip = {
  code: string
  label: string
  selected: boolean
}

export function SendEmailModal({
  open,
  onOpenChange,
  to,
  templateVariables,
  clientId,
  practitionerProfileId,
  mode,
  assessmentCode,
  assessments: initialAssessments,
  onSendComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  to: string
  templateVariables: QuestionnaireEmailTemplateVariables
  clientId: string
  practitionerProfileId: string
  mode: "battery" | "individual"
  assessmentCode?: string
  assessments?: AssessmentChip[]
  onSendComplete: (result: { sent: boolean; email: string }) => void
}) {
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [assessmentChips, setAssessmentChips] = useState<AssessmentChip[]>([])

  useEffect(() => {
    if (!open) return

    const draft = getDefaultEmailDraft(templateVariables)
    setSubject(draft.subject)
    setMessage(draft.message)
    setSendError(null)
    setSending(false)
    setAssessmentChips(
      initialAssessments?.map((item) => ({ ...item })) ?? []
    )
  }, [open, templateVariables, initialAssessments])

  function toggleAssessment(code: string) {
    setAssessmentChips((current) => {
      const selectedCount = current.filter((item) => item.selected).length
      const target = current.find((item) => item.code === code)
      if (!target) return current
      if (target.selected && selectedCount <= 1) return current

      return current.map((item) =>
        item.code === code ? { ...item, selected: !item.selected } : item
      )
    })
  }

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

  async function createQuestionnaireLink(): Promise<QuestionnaireLinkApiResponse> {
    if (mode === "battery") {
      const codes = selectedBatteryCodes(
        assessmentChips as BatteryAssessmentChip[]
      )
      const response = await fetch("/api/assessments/create-battery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          practitioner_profile_id: practitionerProfileId,
          assessment_codes: codes,
        }),
      })
      const data = (await response.json()) as QuestionnaireLinkApiResponse & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to create pre-session questionnaire link."
        )
      }
      return data
    }

    const response = await fetch("/api/assessments/create-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        practitioner_profile_id: practitionerProfileId,
        assessment_code: assessmentCode,
      }),
    })
    const data = (await response.json()) as QuestionnaireLinkApiResponse & {
      error?: string
    }
    if (!response.ok) {
      throw new Error(data.error ?? "Unable to create assessment link.")
    }
    return data
  }

  async function handleSend() {
    setSending(true)
    setSendError(null)

    try {
      const linkData = await createQuestionnaireLink()
      const resolvedVariables: QuestionnaireEmailTemplateVariables = {
        ...linkData.templateVariables,
        expiry_date: formatQuestionnaireExpiryDate(
          new Date(linkData.expires_at)
        ),
      }

      const { subject: resolvedSubject, htmlBody, textBody } =
        buildResolvedEmailBodies(
          message,
          subject,
          linkData.link,
          resolvedVariables
        )

      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject: resolvedSubject,
          htmlBody,
          textBody,
          assessmentAccessLinkId: linkData.assessmentAccessLinkId,
        }),
      })

      const data = (await response.json()) as { sent?: boolean; error?: string }

      if (!response.ok || !data.sent) {
        setSendError(data.error ?? "Unable to send email.")
        onSendComplete({ sent: false, email: to })
        return
      }

      onOpenChange(false)
      onSendComplete({ sent: true, email: to })
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Unable to send email."
      )
      onSendComplete({ sent: false, email: to })
    } finally {
      setSending(false)
    }
  }

  const showAssessmentChips = mode === "battery" && assessmentChips.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send questionnaire email</DialogTitle>
          <DialogDescription>
            Review and edit the email before sending. Changes are not saved for
            next time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showAssessmentChips ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Assessments</p>
              <div className="flex flex-wrap gap-2">
                {assessmentChips.map((chip) => (
                  <Button
                    key={chip.code}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAssessment(chip.code)}
                    className={cn(
                      chip.selected &&
                        "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    )}
                  >
                    {chip.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

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
