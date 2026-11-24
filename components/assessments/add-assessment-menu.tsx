"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { ImportSageSrDialog } from "@/app/clients/[client_id]/assessments/import-sage-sr-dialog"
import { SendCommunicationModal } from "@/components/email/send-communication-modal"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BatteryAssessmentChip } from "@/lib/assessments/battery-defaults"
import type { QuestionnaireEmailTemplateVariables } from "@/lib/email/templates"

export function AddAssessmentMenu({
  clientId,
  clientEmail,
  practiceId,
  practitionerProfileId,
  templateVariables,
  defaultAssessments,
  returnTo,
}: {
  clientId: string
  clientEmail: string | null
  practiceId: string
  practitionerProfileId: string
  templateVariables: QuestionnaireEmailTemplateVariables | null
  defaultAssessments: BatteryAssessmentChip[]
  returnTo: string
}) {
  const router = useRouter()
  const [sendOpen, setSendOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const startHref = `/clients/${clientId}/assessments/start?returnTo=${encodeURIComponent(returnTo)}`

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" className="min-h-11">
            + Add assessment
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Add assessment</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!templateVariables}
            className="flex flex-col items-start gap-0.5 py-2"
            onSelect={(event) => {
              event.preventDefault()
              if (templateVariables) setSendOpen(true)
            }}
          >
            <span className="font-medium">Send assessment to client</span>
            <span className="text-xs text-muted-foreground">
              Email a link the client completes
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex flex-col items-start gap-0.5 py-2"
            onSelect={() => {
              router.push(startHref)
            }}
          >
            <span className="font-medium">Start assessment now</span>
            <span className="text-xs text-muted-foreground">
              Complete it yourself, now
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex flex-col items-start gap-0.5 py-2"
            onSelect={(event) => {
              event.preventDefault()
              setImportOpen(true)
            }}
          >
            <span className="font-medium">Import assessment report</span>
            <span className="text-xs text-muted-foreground">
              Upload a SAGE-SR PDF
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {statusMessage ? (
        <p className="text-xs text-muted-foreground" role="status">
          {statusMessage}
        </p>
      ) : null}

      {templateVariables ? (
        <SendCommunicationModal
          open={sendOpen}
          onOpenChange={setSendOpen}
          practiceId={practiceId}
          clientId={clientId}
          clientEmail={clientEmail}
          practitionerProfileId={practitionerProfileId}
          templateVariables={templateVariables}
          defaultAssessments={defaultAssessments}
          onSendComplete={({ sent, email }) => {
            if (sent) setStatusMessage(`Email sent to ${email}`)
          }}
        />
      ) : null}

      <ImportSageSrDialog
        clientId={clientId}
        open={importOpen}
        onOpenChange={setImportOpen}
        hideTrigger
      />
    </div>
  )
}
