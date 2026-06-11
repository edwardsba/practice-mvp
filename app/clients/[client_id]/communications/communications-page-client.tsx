"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { SendCommunicationModal } from "@/components/email/send-communication-modal"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BatteryAssessmentChip } from "@/lib/assessments/battery-defaults"
import {
  formatCommunicationStatus,
  formatCommunicationTemplateType,
} from "@/lib/communications/format"
import type { QuestionnaireEmailTemplateVariables } from "@/lib/email/templates"

type CommunicationRow = {
  communicationId: string
  sentAt: string
  templateType: string
  toEmail: string
  ccEmail: string | null
  bccEmail: string | null
  subject: string
  messageText: string | null
  status: string
  errorMessage: string | null
}

function formatTableDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function formatTitleDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatSentAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function ReadOnlyField({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={`text-sm ${className ?? ""}`}>{value}</p>
    </div>
  )
}

export function CommunicationsPageClient({
  clientId,
  clientName,
  clientEmail,
  practitionerProfileId,
  templateVariables,
  defaultAssessments,
  communications,
}: {
  clientId: string
  clientName: string
  clientEmail: string | null
  practitionerProfileId: string
  templateVariables: QuestionnaireEmailTemplateVariables | null
  defaultAssessments: BatteryAssessmentChip[]
  communications: CommunicationRow[]
}) {
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [selectedCommunication, setSelectedCommunication] =
    useState<CommunicationRow | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!statusMessage) return
    const timer = window.setTimeout(() => setStatusMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  return (
    <>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/clients/${clientId}`}>← {clientName}</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Communications — {clientName}
          </h1>
          <Button
            type="button"
            onClick={() => setSendModalOpen(true)}
            disabled={!templateVariables}
          >
            Send Communication
          </Button>
        </div>
      </div>

      {statusMessage ? (
        <p className="mb-4 text-sm text-muted-foreground" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {communications.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-20 text-center text-muted-foreground"
                >
                  No communications recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              communications.map((communication) => (
                <TableRow
                  key={communication.communicationId}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedCommunication(communication)}
                >
                  <TableCell>{formatTableDate(communication.sentAt)}</TableCell>
                  <TableCell>
                    {formatCommunicationTemplateType(communication.templateType)}
                  </TableCell>
                  <TableCell>{communication.toEmail}</TableCell>
                  <TableCell>{communication.subject}</TableCell>
                  <TableCell>
                    {formatCommunicationStatus(communication.status)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={selectedCommunication !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCommunication(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selectedCommunication ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Communication — {formatTitleDate(selectedCommunication.sentAt)}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <ReadOnlyField
                  label="Template type"
                  value={formatCommunicationTemplateType(
                    selectedCommunication.templateType
                  )}
                />
                <ReadOnlyField
                  label="Sent at"
                  value={formatSentAt(selectedCommunication.sentAt)}
                />
                <ReadOnlyField
                  label="Status"
                  value={formatCommunicationStatus(selectedCommunication.status)}
                />
                <ReadOnlyField label="To" value={selectedCommunication.toEmail} />
                {selectedCommunication.ccEmail?.trim() ? (
                  <ReadOnlyField
                    label="CC"
                    value={selectedCommunication.ccEmail}
                  />
                ) : null}
                {selectedCommunication.bccEmail?.trim() ? (
                  <ReadOnlyField
                    label="BCC"
                    value={selectedCommunication.bccEmail}
                  />
                ) : null}
                <ReadOnlyField
                  label="Subject"
                  value={selectedCommunication.subject}
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    Message
                  </p>
                  <p className="whitespace-pre-line text-sm">
                    {selectedCommunication.messageText?.trim() || "—"}
                  </p>
                </div>
                {selectedCommunication.status === "failed" &&
                selectedCommunication.errorMessage?.trim() ? (
                  <ReadOnlyField
                    label="Error message"
                    value={selectedCommunication.errorMessage}
                    className="text-destructive"
                  />
                ) : null}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedCommunication(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {templateVariables ? (
        <SendCommunicationModal
          open={sendModalOpen}
          onOpenChange={setSendModalOpen}
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
