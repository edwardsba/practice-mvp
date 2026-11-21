"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"

import { createDraftSessionNote } from "@/app/session-notes/actions"
import {
  exportSessionNotePdfs,
  type ExportSessionNotesState,
} from "@/app/session-notes/actions"
import { ClientPanel } from "@/components/clients/client-panel"
import { SendCommunicationModal } from "@/components/email/send-communication-modal"
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu"
import type { BatteryAssessmentChip } from "@/lib/assessments/battery-defaults"
import type { QuestionnaireEmailTemplateVariables } from "@/lib/email/templates"
import { formatSessionNoteDate } from "@/lib/session-notes/format"

const exportInitial: ExportSessionNotesState = {}

export function ClientSummaryPanel({
  clientId,
  clientEmail,
  practiceId,
  practitionerProfileId,
  templateVariables,
  defaultAssessments,
  children,
}: {
  clientId: string
  clientEmail: string | null
  practiceId: string
  practitionerProfileId: string
  templateVariables: QuestionnaireEmailTemplateVariables | null
  defaultAssessments: BatteryAssessmentChip[]
  children: ReactNode
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [exportState, setExportState] =
    useState<ExportSessionNotesState>(exportInitial)
  const [exportPending, setExportPending] = useState(false)

  useEffect(() => {
    if (!statusMessage) return
    const timer = window.setTimeout(() => setStatusMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  async function handleExport() {
    setExportPending(true)
    setExportState(exportInitial)
    try {
      const result = await exportSessionNotePdfs(clientId, exportInitial)
      setExportState(result)
      if (result.error) {
        setStatusMessage(result.error)
      } else if (result.links && result.links.length > 0) {
        setStatusMessage(
          `${result.links.length} PDF${result.links.length !== 1 ? "s" : ""} ready — links expire in 5 minutes`
        )
      } else {
        setStatusMessage("No session note PDFs to export")
      }
    } finally {
      setExportPending(false)
    }
  }

  const newAppointmentHref = `/appointments/new?clientId=${clientId}&returnTo=${encodeURIComponent(`/clients/${clientId}`)}`
  const addNoteAction = createDraftSessionNote.bind(
    null,
    clientId,
    null,
    `/clients/${clientId}`
  )

  const menuContent = (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={newAppointmentHref}>Create appointment</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!templateVariables}
          onSelect={(event) => {
            event.preventDefault()
            if (templateVariables) setModalOpen(true)
          }}
        >
          Send communication
        </DropdownMenuItem>
        <form action={addNoteAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-default text-left">
              Add session note
            </button>
          </DropdownMenuItem>
        </form>
        <DropdownMenuItem
          disabled={exportPending}
          onSelect={(event) => {
            event.preventDefault()
            void handleExport()
          }}
        >
          {exportPending ? "Preparing…" : "Export session notes"}
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuLabel>Pages</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/clients/${clientId}/appointments`}>Appointments</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/clients/${clientId}/session-notes`}>Session notes</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/clients/${clientId}/reports`}>Reports</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/clients/${clientId}/assessments`}>Assessments</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/clients/${clientId}/claims`}>
            Claims, referrals and funding
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/clients/${clientId}/communications`}>
            Communications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          Tasks
          <DropdownMenuShortcut>Coming soon</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  )

  return (
    <div className="space-y-2">
      <ClientPanel title="Summary" control="menu" menuContent={menuContent}>
        {children}
      </ClientPanel>

      {statusMessage ? (
        <p className="px-1 text-sm text-muted-foreground" role="status">
          {statusMessage}
        </p>
      ) : null}

      {exportState.links && exportState.links.length > 0 ? (
        <ul className="space-y-1 px-1">
          {exportState.links.map((link) => (
            <li key={link.sessionNoteId}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                {formatSessionNoteDate(link.sessionDate)}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

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
    </div>
  )
}
