import Link from "next/link"
import { notFound } from "next/navigation"

import { OngoingAssessmentsTable } from "@/components/session-notes/ongoing-assessments-table"
import { ResendBatteryButton } from "@/components/session-notes/resend-battery-button"
import {
  deleteSessionNote,
  getSessionNoteDeleteStatus,
} from "@/app/session-notes/actions"
import {
  RiskAssessmentTable,
  type RiskAssessmentRow,
} from "@/components/session-notes/risk-assessment-table"
import { MseStatusBadge } from "@/components/session-notes/mse-status-badge"
import { SessionNoteActions } from "@/components/session-notes/session-note-actions"
import { SessionNoteDocument } from "@/components/session-notes/session-note-document"
import { SessionNoteEditorPanel } from "@/components/session-notes/session-note-editor-panel"
import { AppShell } from "@/components/app-shell"
import { BackButton } from "@/components/ui/back-button"
import { EntityPageHeader } from "@/components/ui/entity-page-header"
import { EntityDeleteSection } from "@/components/entity-delete-section"
import { StatusBadge } from "@/components/ui/status-badge"
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
import { SESSION_NOTE_STATUS_CONFIG } from "@/lib/status"

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
  searchParams,
}: {
  params: Promise<{ session_note_id: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { session_note_id: sessionNoteId } = await params
  const { returnTo } = await searchParams
  const context = await requirePractitionerContext()

  const note = await loadSessionNoteForPractice(sessionNoteId, context.practiceId)

  if (!note) {
    notFound()
  }

  const viewContext = await loadSessionNoteViewContext(note)
  const deleteStatus = await getSessionNoteDeleteStatus(sessionNoteId)
  const clientName = formatClientNameLastFirst(
    note.clientFirstName,
    note.clientLastName
  )
  const isFinalised = note.status === "finalised"
  const sessionNoteUrl = returnTo
    ? `/session-notes/${sessionNoteId}?returnTo=${encodeURIComponent(returnTo)}`
    : `/session-notes/${sessionNoteId}`
  const cancelHref = returnTo ?? `/clients/${note.clientId}/session-notes`

  return (
    <AppShell>
      <div className="mb-6 no-print">
        <BackButton
          fallbackHref={`/clients/${note.clientId}`}
          label="← Back to client"
        />
      </div>
      <EntityPageHeader
        kicker="Session note"
        name={clientName}
        subheading={`Date of birth: ${formatDob(note.clientDateOfBirth)}`}
        badge={
          <StatusBadge
            status={isFinalised ? "finalised" : note.status}
            statusMap={SESSION_NOTE_STATUS_CONFIG}
          />
        }
      />

      <SessionNoteEditorPanel
        sessionNoteId={sessionNoteId}
        initialNotes={note.practitionerNotes ?? ""}
        isFinalised={isFinalised}
        cancelHref={cancelHref}
        rightColumn={
          <>
            <SessionNoteActions
              sessionNoteId={sessionNoteId}
              sessionNoteUrl={sessionNoteUrl}
              clientId={note.clientId}
              clientName={clientName}
              status={note.status}
              isFinalised={isFinalised}
              pdfStoragePath={note.pdfStoragePath ?? null}
              appointmentId={note.appointmentId ?? null}
              sessionDate={note.sessionDate}
              sessionTime={note.sessionTime}
              nextAppointment={viewContext.nextAppointment ?? null}
              preSessionBatterySentAt={note.preSessionBatterySentAt}
              psqBatteryStatus={note.psqBatteryStatus}
              asqCompleted={Boolean(viewContext.asqResult)}
            />

            <Card>
              <CardHeader>
                <CardTitle>Mental status examination</CardTitle>
              </CardHeader>
              <CardContent>
                {viewContext.mseInstance ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <MseStatusBadge instance={viewContext.mseInstance} />
                      <Link
                        href={appendReturnTo(
                          `/clients/${note.clientId}/mse/${viewContext.mseInstance.assessmentInstanceId}`,
                          sessionNoteUrl
                        )}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View MSE
                      </Link>
                    </div>
                    {viewContext.mseInstance.sentence ? (
                      <p className="text-sm leading-relaxed">
                        {viewContext.mseInstance.sentence}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <Link
                    href={`/clients/${note.clientId}/mse/new?session_note_id=${sessionNoteId}&returnTo=${encodeURIComponent(sessionNoteUrl)}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Administer MSE
                  </Link>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>Mood Assessment</CardTitle>
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
                  returnTo={sessionNoteUrl}
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
                      administerHref: `/clients/${note.clientId}/asq/new?session_note_id=${sessionNoteId}&returnTo=${encodeURIComponent(sessionNoteUrl)}`,
                    } satisfies RiskAssessmentRow,
                  ]}
                  clientId={note.clientId}
                  returnTo={sessionNoteUrl}
                />
                <div>
                  <p className="mb-1 text-sm font-medium">Crisis plan</p>
                  {viewContext.crisisPlan ? (
                    <Link
                      href={`/clients/${note.clientId}/crisis-plan/${viewContext.crisisPlan.crisisPlanId}?returnTo=${encodeURIComponent(sessionNoteUrl)}`}
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
                <CardTitle>Treatment Plan Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {viewContext.treatmentPlan ? (
                  <Link
                    href={`/clients/${note.clientId}/treatment-plan/${viewContext.treatmentPlan.treatmentPlanId}?returnTo=${encodeURIComponent(sessionNoteUrl)}`}
                    className="mb-3 block text-sm font-medium text-primary hover:underline"
                  >
                    v.{viewContext.treatmentPlan.versionNumber} created:{" "}
                    {formatSessionNoteDate(viewContext.treatmentPlan.startDate)}
                  </Link>
                ) : (
                  <p className="mb-3 text-sm text-muted-foreground">
                    No treatment plan
                  </p>
                )}
                {viewContext.treatmentPlan?.therapeuticTarget ? (
                  <p className="mb-3 text-sm">
                    <span className="font-medium">Therapeutic target: </span>
                    {viewContext.treatmentPlan.therapeuticTarget}
                  </p>
                ) : null}
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
                {viewContext.assistResult ? (
                  <RiskAssessmentTable
                    rows={[
                      {
                        code: "ASSIST",
                        name: "ASSIST",
                        assessmentResultId: viewContext.assistResult.assessmentResultId,
                        score: viewContext.assistResult.score,
                        maxScore: viewContext.assistResult.maxScore,
                        acuteRiskRating: viewContext.assistResult.severity,
                        administerHref: null,
                      } satisfies RiskAssessmentRow,
                    ]}
                    clientId={note.clientId}
                    returnTo={sessionNoteUrl}
                    outcomeColumnLabel="Risk Level"
                  />
                ) : null}
              </CardContent>
            </Card>
          </>
        }
        deleteSection={
          <EntityDeleteSection
            entityName="Session note"
            blockedReason={deleteStatus.blockedReason}
            deleteAction={deleteSessionNote.bind(
              null,
              sessionNoteId,
              context.practiceId
            )}
          />
        }
      />

      <div className="session-note-print-area hidden print:block">
        <SessionNoteDocument
          clientName={clientName}
          dateOfBirth={note.clientDateOfBirth}
          sessionDate={note.sessionDate}
          sessionTime={note.sessionTime}
          therapeuticTarget={viewContext.treatmentPlan?.therapeuticTarget ?? null}
          btpTargets={viewContext.btpTargets}
          assessments={viewContext.assessments}
          assistResult={viewContext.assistResult}
          mseSentence={viewContext.mseInstance?.sentence ?? null}
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
