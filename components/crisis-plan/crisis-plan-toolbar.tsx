"use client"

import Link from "next/link"
import { useState } from "react"

import { SendCrisisPlanEmailModal } from "@/components/crisis-plan/send-crisis-plan-email-modal"
import { Button } from "@/components/ui/button"
import type { CrisisPlanEmailVariables } from "@/lib/email/crisis-plan-templates"

export function CrisisPlanToolbar({
  clientId,
  crisisPlanId,
  isActive,
  clientEmail,
  templateVariables,
}: {
  clientId: string
  crisisPlanId: string
  isActive: boolean
  clientEmail: string | null
  templateVariables: CrisisPlanEmailVariables
}) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)

  async function handleDownloadPdf() {
    setDownloading(true)
    setDownloadError(null)

    try {
      const response = await fetch("/api/crisis-plan/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crisis_plan_id: crisisPlanId }),
      })

      const data = (await response.json()) as {
        signedUrl?: string
        error?: string
      }

      if (!response.ok || !data.signedUrl) {
        setDownloadError(data.error ?? "Unable to generate PDF.")
        return
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer")
    } catch {
      setDownloadError("Unable to generate PDF.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {isActive ? (
          <Button asChild variant="outline">
            <Link href={`/clients/${clientId}/crisis-plan/${crisisPlanId}/edit`}>
              Edit / Create new version
            </Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={handleDownloadPdf}
          disabled={downloading}
        >
          {downloading ? "Generating PDF…" : "Download PDF"}
        </Button>
        {clientEmail ? (
          <Button type="button" onClick={() => setEmailModalOpen(true)}>
            Send to Client
          </Button>
        ) : (
          <Button type="button" disabled title="No email on file">
            Send to Client
          </Button>
        )}
      </div>

      {downloadError ? (
        <p className="text-sm text-destructive" role="alert">
          {downloadError}
        </p>
      ) : null}

      {emailStatus ? (
        <p className="text-sm font-medium text-foreground">{emailStatus}</p>
      ) : null}

      {clientEmail ? (
        <SendCrisisPlanEmailModal
          open={emailModalOpen}
          onOpenChange={setEmailModalOpen}
          to={clientEmail}
          crisisPlanId={crisisPlanId}
          templateVariables={templateVariables}
          onSendComplete={({ sent }) => {
            setEmailStatus(
              sent
                ? `Email sent to ${clientEmail}`
                : "Email failed — try Download PDF and send manually."
            )
          }}
        />
      ) : null}
    </div>
  )
}
