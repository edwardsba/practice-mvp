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
  getEmailTemplateById,
  getEmailTemplatesForDropdown,
} from "@/lib/actions/email-templates"
import {
  selectedBatteryCodes,
  type BatteryAssessmentChip,
} from "@/lib/assessments/battery-defaults"
import type { QuestionnaireLinkApiResponse } from "@/lib/email/link-response"
import {
  buildAdHocHtmlEmailBody,
  buildResolvedEmailBodies,
  EMAIL_TEMPLATE_VARIABLE_CHIPS,
  formatQuestionnaireExpiryDate,
  QUESTIONNAIRE_LINK_VARIABLE,
  resolveTemplate,
  type QuestionnaireEmailTemplateVariables,
} from "@/lib/email/templates"
import { cn } from "@/lib/utils"

type AssessmentChip = {
  code: string
  label: string
  selected: boolean
}

type TemplateDropdownOption = {
  emailTemplateId: string
  name: string
  templateKey: string | null
}

type LoadedTemplate = {
  emailTemplateId: string
  templateKey: string | null
  name: string
  subject: string
  message: string
  defaultCc: string | null
  defaultBcc: string | null
  hasActionButton: boolean
  actionButtonLabel: string | null
}

export function SendCommunicationModal({
  open,
  onOpenChange,
  practiceId,
  clientId,
  clientEmail,
  practitionerProfileId,
  templateVariables,
  defaultAssessments,
  onSendComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  practiceId: string
  clientId: string
  clientEmail: string | null
  practitionerProfileId: string
  templateVariables: QuestionnaireEmailTemplateVariables
  defaultAssessments?: AssessmentChip[]
  onSendComplete: (result: { sent: boolean; email: string }) => void
}) {
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const [templateOptions, setTemplateOptions] = useState<
    TemplateDropdownOption[]
  >([])
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [loadedTemplate, setLoadedTemplate] = useState<LoadedTemplate | null>(
    null
  )
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [assessmentChips, setAssessmentChips] = useState<AssessmentChip[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  const toEmail = clientEmail?.trim() ?? ""
  const hasEmail = Boolean(toEmail)
  const templateKey = loadedTemplate?.templateKey ?? null

  useEffect(() => {
    if (!open) return

    setSendError(null)
    setSending(false)
    setAssessmentChips(defaultAssessments?.map((item) => ({ ...item })) ?? [])

    let cancelled = false

    async function loadTemplates() {
      setLoadingTemplates(true)
      try {
        const options = await getEmailTemplatesForDropdown(practiceId)
        if (cancelled) return

        setTemplateOptions(options)

        const defaultOption =
          options.find((option) => option.templateKey === "send_assessment") ??
          options[0]

        if (defaultOption) {
          setSelectedTemplateId(defaultOption.emailTemplateId)
          await applyTemplate(defaultOption.emailTemplateId)
        } else {
          setSelectedTemplateId("")
          setLoadedTemplate(null)
          setSubject("")
          setMessage("")
          setCc("")
          setBcc("")
        }
      } finally {
        if (!cancelled) {
          setLoadingTemplates(false)
        }
      }
    }

    void loadTemplates()

    return () => {
      cancelled = true
    }
  }, [open, practiceId, templateVariables, defaultAssessments])

  async function applyTemplate(templateId: string) {
    const template = await getEmailTemplateById(practiceId, templateId)
    if (!template) return

    setLoadedTemplate({
      emailTemplateId: template.emailTemplateId,
      templateKey: template.templateKey,
      name: template.name,
      subject: template.subject,
      message: template.message,
      defaultCc: template.defaultCc,
      defaultBcc: template.defaultBcc,
      hasActionButton: template.hasActionButton,
      actionButtonLabel: template.actionButtonLabel,
    })

    if (
      template.templateKey === "send_assessment" ||
      template.templateKey === "diagnostic_battery"
    ) {
      setSubject(
        resolveTemplate(template.subject, {
          ...templateVariables,
          questionnaire_link: "",
        })
      )
      setMessage(
        resolveTemplate(template.message, {
          ...templateVariables,
          questionnaire_link: QUESTIONNAIRE_LINK_VARIABLE,
        })
      )
    } else {
      setSubject(
        resolveTemplate(template.subject, {
          ...templateVariables,
          questionnaire_link: "",
        })
      )
      setMessage(
        resolveTemplate(template.message, {
          ...templateVariables,
          questionnaire_link: "",
        })
      )
    }

    setCc(template.defaultCc?.trim() ?? "")
    setBcc(template.defaultBcc?.trim() ?? "")
  }

  async function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId)
    await applyTemplate(templateId)
  }

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

  async function createDiagnosticBatteryLink(): Promise<QuestionnaireLinkApiResponse> {
    const response = await fetch("/api/assessments/create-diagnostic-battery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        practitioner_profile_id: practitionerProfileId,
      }),
    })
    const data = (await response.json()) as QuestionnaireLinkApiResponse & {
      error?: string
    }
    if (!response.ok) {
      throw new Error(
        data.error ?? "Unable to create diagnostic assessment link."
      )
    }
    return data
  }

  async function handleSend() {
    if (!hasEmail || !loadedTemplate) return

    setSending(true)
    setSendError(null)

    const templateType = loadedTemplate.templateKey ?? "generic"

    try {
      if (templateKey === "send_assessment") {
        const linkData = await createQuestionnaireLink()
        const resolvedVariables: QuestionnaireEmailTemplateVariables = {
          ...linkData.templateVariables,
          expiry_date: formatQuestionnaireExpiryDate(
            new Date(linkData.expires_at)
          ),
        }

        const buttonLabel =
          loadedTemplate.actionButtonLabel?.trim() || "Complete Questionnaire"

        const {
          subject: resolvedSubject,
          htmlBody,
          textBody,
        } = buildResolvedEmailBodies(
          message,
          subject,
          linkData.link,
          resolvedVariables,
          buttonLabel
        )

        const response = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: toEmail,
            cc: cc.trim() || undefined,
            bcc: bcc.trim() || undefined,
            subject: resolvedSubject,
            htmlBody,
            textBody,
            messageText: message,
            templateType,
            assessmentAccessLinkId: linkData.assessmentAccessLinkId,
          }),
        })

        const data = (await response.json()) as {
          sent?: boolean
          error?: string
        }

        if (!response.ok || !data.sent) {
          setSendError(data.error ?? "Unable to send email.")
          onSendComplete({ sent: false, email: toEmail })
          return
        }
      } else if (templateKey === "diagnostic_battery") {
        const linkData = await createDiagnosticBatteryLink()
        const resolvedVariables: QuestionnaireEmailTemplateVariables = {
          ...linkData.templateVariables,
          expiry_date: formatQuestionnaireExpiryDate(
            new Date(linkData.expires_at)
          ),
        }

        const buttonLabel =
          loadedTemplate.actionButtonLabel?.trim() ||
          "Complete Diagnostic Assessment"

        const {
          subject: resolvedSubject,
          htmlBody,
          textBody,
        } = buildResolvedEmailBodies(
          message,
          subject,
          linkData.link,
          resolvedVariables,
          buttonLabel
        )

        const response = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: toEmail,
            cc: cc.trim() || undefined,
            bcc: bcc.trim() || undefined,
            subject: resolvedSubject,
            htmlBody,
            textBody,
            messageText: message,
            templateType,
            assessmentAccessLinkId: linkData.assessmentAccessLinkId,
          }),
        })

        const data = (await response.json()) as {
          sent?: boolean
          error?: string
        }

        if (!response.ok || !data.sent) {
          setSendError(data.error ?? "Unable to send email.")
          onSendComplete({ sent: false, email: toEmail })
          return
        }
      } else if (
        loadedTemplate.hasActionButton &&
        templateKey !== "send_assessment" &&
        templateKey !== "diagnostic_battery"
      ) {
        // TODO: Generic action-button templates need a link source wired in code.
        const resolvedSubject = resolveTemplate(subject, {
          ...templateVariables,
          questionnaire_link: "",
        })
        const htmlBody = buildAdHocHtmlEmailBody(message)
        const textBody = message.replace(/\n{3,}/g, "\n\n")

        const response = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: toEmail,
            cc: cc.trim() || undefined,
            bcc: bcc.trim() || undefined,
            subject: resolvedSubject,
            htmlBody,
            textBody,
            messageText: message,
            templateType,
            clientId,
          }),
        })

        const data = (await response.json()) as {
          sent?: boolean
          error?: string
        }

        if (!response.ok || !data.sent) {
          setSendError(data.error ?? "Unable to send email.")
          onSendComplete({ sent: false, email: toEmail })
          return
        }
      } else {
        const resolvedSubject = resolveTemplate(subject, {
          ...templateVariables,
          questionnaire_link: "",
        })
        const htmlBody = buildAdHocHtmlEmailBody(message)
        const textBody = message.replace(/\n{3,}/g, "\n\n")

        const response = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: toEmail,
            cc: cc.trim() || undefined,
            bcc: bcc.trim() || undefined,
            subject: resolvedSubject,
            htmlBody,
            textBody,
            messageText: message,
            templateType,
            clientId,
          }),
        })

        const data = (await response.json()) as {
          sent?: boolean
          error?: string
        }

        if (!response.ok || !data.sent) {
          setSendError(data.error ?? "Unable to send email.")
          onSendComplete({ sent: false, email: toEmail })
          return
        }
      }

      onOpenChange(false)
      onSendComplete({ sent: true, email: toEmail })
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Unable to send email."
      )
      onSendComplete({ sent: false, email: toEmail })
    } finally {
      setSending(false)
    }
  }

  const showAssessmentChips =
    templateKey === "send_assessment" && assessmentChips.length > 0
  const selectedAssessmentCount = assessmentChips.filter(
    (item) => item.selected
  ).length
  const isAdHoc = templateKey === "ad_hoc"
  const canSend =
    hasEmail &&
    Boolean(loadedTemplate) &&
    (isAdHoc || subject.trim().length > 0) &&
    (isAdHoc || templateKey !== "send_assessment" || selectedAssessmentCount > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send communication</DialogTitle>
          <DialogDescription>
            Review and edit the email before sending. Changes are not saved for
            next time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email_template">Email Template</Label>
            <select
              id="email_template"
              value={selectedTemplateId}
              onChange={(e) => void handleTemplateChange(e.target.value)}
              disabled={loadingTemplates || templateOptions.length === 0}
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            >
              {templateOptions.length === 0 ? (
                <option value="">No templates available</option>
              ) : (
                templateOptions.map((option) => (
                  <option
                    key={option.emailTemplateId}
                    value={option.emailTemplateId}
                  >
                    {option.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_to">To</Label>
            <Input
              id="email_to"
              type="email"
              value={toEmail}
              readOnly
              disabled
              className="bg-muted text-muted-foreground"
            />
            {!hasEmail ? (
              <p className="text-sm text-muted-foreground">
                No email address on file for this client
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_cc">CC</Label>
            <Input
              id="email_cc"
              type="email"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_bcc">BCC</Label>
            <Input
              id="email_bcc"
              type="email"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="Optional"
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
          <Button
            type="button"
            onClick={handleSend}
            disabled={sending || !canSend}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
