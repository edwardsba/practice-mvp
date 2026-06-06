import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { CollapsibleSection } from "@/components/session-notes/collapsible-section"
import { SessionNoteActions } from "@/components/session-notes/session-note-actions"
import { SessionNoteDocument } from "@/components/session-notes/session-note-document"
import { Button } from "@/components/ui/button"
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
import {
  formatSessionNoteDate,
  formatSessionNoteTime,
} from "@/lib/session-notes/format"
import { appendReturnTo } from "@/lib/navigation/back"
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

  const note = await loadSessionNoteForPractice(
    sessionNoteId,
    context.practiceId
  )

  if (!note) {
    notFound()
  }

  const viewContext = await loadSessionNoteViewContext(note)
  const clientName = formatClientNameLastFirst(
    note.clientFirstName,
    note.clientLastName
  )
  const isDraft = note.status === "draft"
  const sessionNoteReturnTo = `/session-notes/${sessionNoteId}`

  return (
    <AppShell>
      <div className="mb-6 no-print">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/clients/${note.clientId}`}>← Back to client</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Session Note</h1>
      </div>

      <SessionNoteActions
        sessionNoteId={sessionNoteId}
        status={note.status}
      />

      <div className="no-print space-y-0">
        <CollapsibleSection title="Client & Session Details">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Client</dt>
              <dd className="font-medium">
                <Link
                  href={`/clients/${note.clientId}`}
                  className="text-primary hover:underline"
                >
                  {clientName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Date of birth</dt>
              <dd className="font-medium">{formatDob(note.clientDateOfBirth)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Session date</dt>
              <dd className="font-medium">
                {formatSessionNoteDate(note.sessionDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Session time</dt>
              <dd className="font-medium">
                {formatSessionNoteTime(note.sessionTime)}
              </dd>
            </div>
          </dl>
        </CollapsibleSection>

        <CollapsibleSection title="Treatment Plan">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Therapeutic target</p>
            <p className="font-medium text-sm">
              {viewContext.therapeuticTarget || "No treatment plan"}
            </p>
          </div>
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
                      <TableCell>{row.score}</TableCell>
                      <TableCell>{row.ratingLabel}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Ongoing Assessments">
          <div className="space-y-6">
            {viewContext.assessments.map((result) => (
              <div key={result.code}>
                <h3 className="mb-2 text-sm font-semibold">{result.name}</h3>
                {!result.assessmentResultId ? (
                  <p className="text-sm text-muted-foreground">
                    Not completed this session.
                  </p>
                ) : (
                  <>
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Score</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Functional Impairment</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="hover:bg-muted/50">
                            <TableCell>{result.score}</TableCell>
                            <TableCell className="capitalize">
                              {result.severity ?? "—"}
                            </TableCell>
                            <TableCell>
                              {result.functionalImpairmentLabel ?? "—"}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <Link
                      href={appendReturnTo(
                        `/clients/${note.clientId}/results/${result.assessmentResultId}`,
                        sessionNoteReturnTo
                      )}
                      className="mt-2 inline-block text-sm text-primary hover:underline"
                    >
                      View full result
                    </Link>
                  </>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Risk Assessment">
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">ASQ</h3>
              {viewContext.asqResult ? (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Acute Risk Rating</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="hover:bg-muted/50">
                        <TableCell>
                          <Link
                            href={appendReturnTo(
                              `/clients/${note.clientId}/results/${viewContext.asqResult.assessmentResultId}`,
                              sessionNoteReturnTo
                            )}
                            className="block font-medium text-primary hover:underline"
                          >
                            {formatSessionNoteDate(
                              viewContext.asqResult.assessmentDate ??
                                note.sessionDate
                            )}
                          </Link>
                        </TableCell>
                        <TableCell>{viewContext.asqResult.score}</TableCell>
                        <TableCell>
                          {viewContext.asqResult.acuteRiskRating ?? "—"}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={appendReturnTo(
                      `/clients/${note.clientId}/asq/new`,
                      sessionNoteReturnTo
                    )}
                  >
                    Administer ASQ
                  </Link>
                </Button>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Crisis Plan</h3>
              {viewContext.crisisPlan ? (
                <div className="space-y-1 text-sm">
                  <p>
                    Active plan v{viewContext.crisisPlan.versionNumber} (
                    {formatSessionNoteDate(viewContext.crisisPlan.dateOfPlan)})
                  </p>
                  <p>
                    {viewContext.crisisPlan.updatedThisSession
                      ? "Updated this session"
                      : "Not updated"}
                  </p>
                  <Link
                    href={appendReturnTo(
                      `/clients/${note.clientId}/crisis-plan/${viewContext.crisisPlan.crisisPlanId}`,
                      sessionNoteReturnTo
                    )}
                    className="text-primary hover:underline"
                  >
                    View crisis plan
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active crisis plan.
                </p>
              )}
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Practitioner Notes">
          <p className="whitespace-pre-wrap text-sm">
            {note.practitionerNotes?.trim() || "—"}
          </p>
          {isDraft ? (
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href={`/session-notes/${sessionNoteId}/edit`}>Edit</Link>
            </Button>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection title="Next Appointment">
          {viewContext.nextAppointment ? (
            <Link
              href={appendReturnTo(
                `/appointments/${viewContext.nextAppointment.appointmentId}`,
                sessionNoteReturnTo
              )}
              className="text-sm text-primary hover:underline"
            >
              {viewContext.nextAppointment.label}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              No upcoming appointment
            </p>
          )}
        </CollapsibleSection>
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
