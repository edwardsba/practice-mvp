"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  getQuestionnaireLinkEmailStatusMessage,
  type QuestionnaireLinkEmailReason,
} from "@/lib/email/questionnaire-link-status"

type LinkResult = {
  link: string
  expires_at: string
  emailSent: boolean
  emailReason?: QuestionnaireLinkEmailReason
  clientEmail?: string | null
}

function formatExpiry(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
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
  const [copied, setCopied] = useState(false)

  async function handleSend() {
    setLoading(true)
    setError(null)
    setCopied(false)

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

      const data = (await response.json()) as LinkResult & { error?: string }

      if (!response.ok) {
        setResult(null)
        setError(data.error ?? "Unable to create assessment link.")
        return
      }

      setResult({
        link: data.link,
        expires_at: data.expires_at,
        emailSent: data.emailSent,
        emailReason: data.emailReason,
        clientEmail: data.clientEmail,
      })
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

  const emailStatusMessage = result
    ? getQuestionnaireLinkEmailStatusMessage(
        result.emailSent,
        result.emailReason,
        result.clientEmail
      )
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
        <div className="w-full rounded-lg border border-primary/20 bg-muted/40 p-4">
          {emailStatusMessage ? (
            <p className="mb-3 text-sm font-medium text-foreground">
              {emailStatusMessage}
            </p>
          ) : null}
          <p className="mb-2 text-sm font-medium">{linkHeading}</p>
          <p className="mb-3 break-all rounded-md border bg-background px-3 py-2 font-mono text-sm">
            {result.link}
          </p>
          <p className="mb-3 text-sm text-muted-foreground">
            Expires: {formatExpiry(result.expires_at)}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
