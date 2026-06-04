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

export function SendBatteryButton({
  clientId,
  practitionerProfileId,
}: {
  clientId: string
  practitionerProfileId: string
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
      const response = await fetch("/api/assessments/create-battery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          practitioner_profile_id: practitionerProfileId,
        }),
      })

      const data = (await response.json()) as LinkResult & { error?: string }

      if (!response.ok) {
        setResult(null)
        setError(
          data.error ?? "Unable to create pre-session questionnaire link."
        )
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
      setError("Unable to create pre-session questionnaire link. Please try again.")
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
    <div className="space-y-4">
      <Button type="button" onClick={handleSend} disabled={loading} size="lg">
        {loading ? "Creating link…" : "Send Pre-Session Questionnaire"}
      </Button>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-primary/20 bg-muted/40 p-4">
          {emailStatusMessage ? (
            <p className="mb-3 text-sm font-medium text-foreground">
              {emailStatusMessage}
            </p>
          ) : null}
          <p className="mb-2 text-sm font-medium">
            Pre-Session Questionnaire link — send this to your client
          </p>
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
