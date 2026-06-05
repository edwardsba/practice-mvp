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

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/session-notes">← Back to session notes</Link>
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
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">
                Therapeutic target
              </dt>
              <dd className="font-medium">
                {viewContext.therapeuticTarget || "No treatment plan"}
              </dd>
            </div>
          </dl>
        </CollapsibleSection>

        <CollapsibleSection title="Behavioural Targets Progress">
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

        <CollapsibleSection title="Assessment Results">
          <div className="space-y-6">
            {viewContext.assessments.map((result) => (
              <div key={result.code}>
                <h3 className="mb-2 text-sm font-semibold">{result.name}</h3>
                {!result.assessmentResultId ? (
                  <p className="text-sm text-muted-foreground">
                    Not completed this session.
                  </p>
                ) : (
                  <div className="space-y-1 text-sm">
                    <p>
                      Score: {result.score}
                      {result.maxScore != null ? ` / ${result.maxScore}` : null}
                    </p>
                    {result.severity ? (
                      <p>Severity: {result.severity}</p>
                    ) : null}
                    {result.functionalImpairmentLabel ? (
                      <p>
                        Functional Impairment:{" "}
                        {result.functionalImpairmentLabel}
                      </p>
                    ) : null}
                    <Link
                      href={`/clients/${note.clientId}/results/${result.assessmentResultId}`}
                      className="text-primary hover:underline"
                    >
                      View full result
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Risk">
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">ASQ</h3>
              {viewContext.asqResult ? (
                <div className="space-y-1 text-sm">
                  <p>Score: {viewContext.asqResult.score}</p>
                  {viewContext.asqResult.acuteRiskRating ? (
                    <p>
                      Acute risk rating:{" "}
                      {viewContext.asqResult.acuteRiskRating}
                    </p>
                  ) : null}
                  <Link
                    href={`/clients/${note.clientId}/results/${viewContext.asqResult.assessmentResultId}`}
                    className="text-primary hover:underline"
                  >
                    View ASQ result
                  </Link>
                </div>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/clients/${note.clientId}/asq/new`}>
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
                    href={`/clients/${note.clientId}/crisis-plan/${viewContext.crisisPlan.crisisPlanId}`}
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
              href={`/appointments/${viewContext.nextAppointment.appointmentId}`}
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
