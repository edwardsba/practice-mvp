import Link from "next/link"
import { notFound } from "next/navigation"

import { OngoingAssessmentsTable } from "@/components/session-notes/ongoing-assessments-table"
import { ResendBatteryButton } from "@/components/session-notes/resend-battery-button"
import {
  RiskAssessmentTable,
  type RiskAssessmentRow,
} from "@/components/session-notes/risk-assessment-table"
import { SessionDateTimeEditor } from "@/components/session-notes/session-date-time-editor"
import { SessionNoteActions } from "@/components/session-notes/session-note-actions"
import { SessionNoteDocument } from "@/components/session-notes/session-note-document"
import { SessionNotesEditor } from "@/components/session-notes/session-notes-editor"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatClientNameLastFirst } from "@/lib/appointments/format"
import { requirePractitionerContext } from "@/lib/auth"
import { appendReturnTo } from "@/lib/navigation/back"
import { formatSessionNoteDate } from "@/lib/session-notes/format"
import { loadSessionNoteViewContext } from "@/lib/session-notes/load-context"
import { loadSessionNoteForPractice } from "@/lib/session-notes/load"

import "@/components/session-notes/session-note-print.css"

function formatDob(value: string | null) {
  if (!value) return "—"
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function SessionNoteViewPage({
  params,
}: {
  params: Promise<{ session_note_id: string }>
}) {
  const { session_note_id: sessionNoteId } = await params
  const context = await requirePractitionerContext()

  const note = await loadSessionNoteForPractice(sessionNoteId, context.practiceId)

  if (!note) {
    notFound()
  }

  const viewContext = await loadSessionNoteViewContext(note)
  const clientName = formatClientNameLastFirst(
    note.clientFirstName,
    note.clientLastName
  )
  const isFinalised = note.status === "finalised"

  return (
    <AppShell>
      <div className="mb-6 no-print">
        <BackButton
          fallbackHref={`/clients/${note.clientId}`}
          label="← Back to client"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              <Link href={`/clients/${note.clientId}`} className="hover:underline">
                {clientName}
              </Link>
            </h1>
            <p className="text-sm text-muted-foreground">
              Date of birth: {formatDob(note.clientDateOfBirth)}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <SessionDateTimeEditor
              sessionNoteId={sessionNoteId}
              sessionDate={note.sessionDate}
              sessionTime={note.sessionTime}
              readOnly={isFinalised}
            />
            {note.appointmentId ? (
              <Link
                href={appendReturnTo(
                  `/appointments/${note.appointmentId}`,
                  `/session-notes/${sessionNoteId}`
                )}
                className="text-sm text-primary hover:underline"
              >
                View appointment →
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <SessionNoteActions
        sessionNoteId={sessionNoteId}
        status={note.status}
        pdfStoragePath={note.pdfStoragePath ?? null}
      />

      <div className="no-print grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <SessionNotesEditor
          sessionNoteId={sessionNoteId}
          initialNotes={note.practitionerNotes ?? ""}
          readOnly={isFinalised}
        />

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Treatment plan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm">
                {viewContext.therapeuticTarget || "No treatment plan"}
              </p>
              {viewContext.btpTargets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No BTP results for this session.
                </p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Target</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewContext.btpTargets.map((row) => (
                        <TableRow key={row.target}>
                          <TableCell>{row.target}</TableCell>
                          <TableCell>{row.score} / 5</TableCell>
                          <TableCell>{row.ratingLabel}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Ongoing assessments</CardTitle>
              {!isFinalised &&
              note.appointmentId &&
              viewContext.assessments.some((a) => !a.assessmentResultId) ? (
                <ResendBatteryButton appointmentId={note.appointmentId} />
              ) : null}
            </CardHeader>
            <CardContent>
              <OngoingAssessmentsTable
                assessments={viewContext.assessments}
                clientId={note.clientId}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RiskAssessmentTable
                rows={[
                  {
                    code: "ASQ",
                    name: "ASQ",
                    assessmentResultId: viewContext.asqResult?.assessmentResultId ?? null,
                    score: viewContext.asqResult?.score ?? null,
                    maxScore: viewContext.asqResult?.maxScore ?? null,
                    acuteRiskRating: viewContext.asqResult?.acuteRiskRating ?? null,
                    administerHref: `/clients/${note.clientId}/asq/new?session_note_id=${sessionNoteId}`,
                  } satisfies RiskAssessmentRow,
                ]}
                clientId={note.clientId}
              />
              <div>
                <p className="mb-1 text-sm font-medium">Crisis plan</p>
                {viewContext.crisisPlan ? (
                  <Link
                    href={`/clients/${note.clientId}/crisis-plan/${viewContext.crisisPlan.crisisPlanId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    v{viewContext.crisisPlan.versionNumber} (
                    {formatSessionNoteDate(viewContext.crisisPlan.dateOfPlan)})
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">No active crisis plan.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next appointment</CardTitle>
            </CardHeader>
            <CardContent>
              {viewContext.nextAppointment ? (
                <Link
                  href={appendReturnTo(
                    `/appointments/${viewContext.nextAppointment.appointmentId}`,
                    `/session-notes/${sessionNoteId}`
                  )}
                  className="text-sm text-primary hover:underline"
                >
                  {viewContext.nextAppointment.label}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming appointment</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="session-note-print-area hidden print:block">
        <SessionNoteDocument
          clientName={clientName}
          dateOfBirth={note.clientDateOfBirth}
          sessionDate={note.sessionDate}
          sessionTime={note.sessionTime}
          therapeuticTarget={viewContext.therapeuticTarget}
          btpTargets={viewContext.btpTargets}
          assessments={viewContext.assessments}
          asqResult={viewContext.asqResult}
          crisisPlan={viewContext.crisisPlan}
          practitionerNotes={note.practitionerNotes}
          nextAppointment={viewContext.nextAppointment}
          practitionerName={viewContext.practitionerName}
          practitionerTitle={viewContext.practitionerTitle}
        />
      </div>
    </AppShell>
  )
}
