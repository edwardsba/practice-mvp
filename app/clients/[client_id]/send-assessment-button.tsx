"use client"

import { useState } from "react"

import { QuestionnaireLinkPanel } from "@/components/email/questionnaire-link-panel"
import { SendEmailModal } from "@/components/email/send-email-modal"
import { Button } from "@/components/ui/button"
import type { QuestionnaireLinkApiResponse } from "@/lib/email/link-response"
import type { QuestionnaireEmailTemplateVariables } from "@/lib/email/templates"

type LinkResult = {
  link: string
  expires_at: string
  clientEmail: string | null
  assessmentAccessLinkId: string
  templateVariables: QuestionnaireEmailTemplateVariables
}

type EmailStatus = "no_email" | "sent" | "failed" | null

function getStatusMessage(
  status: EmailStatus,
  clientEmail: string | null
): string | null {
  if (status === "no_email") return "No email on file"
  if (status === "sent" && clientEmail) return `Email sent to ${clientEmail}`
  if (status === "failed")
    return "Email failed — copy link below and send manually"
  return null
}

export function SendAssessmentButton({
  clientId,
  practitionerProfileId,
  assessmentCode,
  buttonLabel,
  linkHeading,
  compact = false,
}: {
  clientId: string
  practitionerProfileId: string
  assessmentCode: string
  buttonLabel: string
  linkHeading: string
  compact?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<LinkResult | null>(null)
  const [emailStatus, setEmailStatus] = useState<EmailStatus>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSend() {
    setLoading(true)
    setError(null)
    setCopied(false)
    setEmailStatus(null)

    try {
      const response = await fetch("/api/assessments/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          assessment_code: assessmentCode,
          practitioner_profile_id: practitionerProfileId,
        }),
      })

      const data = (await response.json()) as QuestionnaireLinkApiResponse & {
        error?: string
      }

      if (!response.ok) {
        setResult(null)
        setError(data.error ?? "Unable to create assessment link.")
        return
      }

      const linkResult: LinkResult = {
        link: data.link,
        expires_at: data.expires_at,
        clientEmail: data.clientEmail,
        assessmentAccessLinkId: data.assessmentAccessLinkId,
        templateVariables: data.templateVariables,
      }

      setResult(linkResult)

      if (data.clientEmail) {
        setModalOpen(true)
      } else {
        setEmailStatus("no_email")
      }
    } catch {
      setResult(null)
      setError("Unable to create assessment link. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!result?.link) return
    try {
      await navigator.clipboard.writeText(result.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not copy link to clipboard.")
    }
  }

  const statusMessage = result
    ? getStatusMessage(emailStatus, result.clientEmail)
    : null

  return (
    <div
      className={
        compact
          ? "flex w-full min-w-[200px] flex-1 flex-col gap-3"
          : "flex w-full max-w-xl flex-col items-end gap-4"
      }
    >
      <Button
        type="button"
        variant={compact ? "outline" : "default"}
        size={compact ? "sm" : "default"}
        onClick={handleSend}
        disabled={loading}
        className={compact ? "w-full" : undefined}
      >
        {loading ? "Creating link…" : buttonLabel}
      </Button>

      {error ? (
        <p
          className={`w-full text-sm text-destructive ${compact ? "" : "text-right"}`}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <QuestionnaireLinkPanel
          linkHeading={linkHeading}
          link={result.link}
          expiresAt={result.expires_at}
          statusMessage={statusMessage}
          onCopy={handleCopy}
          copied={copied}
          alignEnd={!compact}
        />
      ) : null}

      {result?.clientEmail ? (
        <SendEmailModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          to={result.clientEmail}
          linkUrl={result.link}
          assessmentAccessLinkId={result.assessmentAccessLinkId}
          templateVariables={result.templateVariables}
          onSendComplete={({ sent }) => {
            setEmailStatus(sent ? "sent" : "failed")
          }}
        />
      ) : null}
    </div>
  )
}
