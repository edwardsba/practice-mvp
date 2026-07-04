"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { createDraftSessionNote } from "@/app/session-notes/actions"
import { SendCommunicationModal } from "@/components/email/send-communication-modal"
import { ExportSessionNotesButton } from "@/components/session-notes/export-session-notes-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { BatteryAssessmentChip } from "@/lib/assessments/battery-defaults"
import type { QuestionnaireEmailTemplateVariables } from "@/lib/email/templates"

export function ActionItemsSection({
  clientId,
  clientEmail,
  practiceId,
  practitionerProfileId,
  templateVariables,
  defaultAssessments,
}: {
  clientId: string
  clientEmail: string | null
  practiceId: string
  practitionerProfileId: string
  templateVariables: QuestionnaireEmailTemplateVariables | null
  defaultAssessments: BatteryAssessmentChip[]
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!statusMessage) return
    const timer = window.setTimeout(() => setStatusMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Action Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link
                href={`/appointments/new?clientId=${clientId}&returnTo=${encodeURIComponent(`/clients/${clientId}`)}`}
              >
                New Appointment
              </Link>
            </Button>
            <Button variant="outline" disabled>
              Edit Appointment
            </Button>
            <form
              action={createDraftSessionNote.bind(
                null,
                clientId,
                null,
                `/clients/${clientId}`
              )}
            >
              <Button type="submit" variant="outline">
                Add Session Note
              </Button>
            </form>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(true)}
              disabled={!templateVariables}
            >
              Send Communication
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/clients/${clientId}/reports/new`}>
                Create Report
              </Link>
            </Button>
            <ExportSessionNotesButton clientId={clientId} />
          </div>

          {statusMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {statusMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {templateVariables ? (
        <SendCommunicationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          practiceId={practiceId}
          clientId={clientId}
          clientEmail={clientEmail}
          practitionerProfileId={practitionerProfileId}
          templateVariables={templateVariables}
          defaultAssessments={defaultAssessments}
          onSendComplete={({ sent, email }) => {
            if (sent) {
              setStatusMessage(`Email sent to ${email}`)
            }
          }}
        />
      ) : null}
    </>
  )
}
