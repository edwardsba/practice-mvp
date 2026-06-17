import type {
  SessionNoteAssessmentResult,
  SessionNoteAsqResult,
  SessionNoteBtpTarget,
  SessionNoteCrisisPlanInfo,
  SessionNoteNextAppointment,
} from "@/lib/session-notes/load-context"
import {
  formatSessionNoteDate,
  formatSessionNoteTime,
} from "@/lib/session-notes/format"

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

function BtpTable({ targets }: { targets: SessionNoteBtpTarget[] }) {
  if (targets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No BTP results for this session.
      </p>
    )
  }

  return (
    <table className="report-results-table w-full text-sm">
      <thead>
        <tr>
          <th>Target</th>
          <th>Score</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody>
        {targets.map((row) => (
          <tr key={row.target}>
            <td>{row.target}</td>
            <td>{row.score}</td>
            <td>{row.ratingLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AssessmentBlock({ result }: { result: SessionNoteAssessmentResult }) {
  if (!result.assessmentResultId) {
    return (
      <p className="text-sm text-muted-foreground">Not completed this session.</p>
    )
  }

  return (
    <table className="report-results-table w-full text-sm">
      <thead>
        <tr>
          <th>Score</th>
          <th>Severity</th>
          <th>Functional Impairment</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            {result.score}
            {result.maxScore != null ? ` / ${result.maxScore}` : ""}
          </td>
          <td className="capitalize">{result.severity ?? "—"}</td>
          <td>{result.functionalImpairmentLabel ?? "—"}</td>
        </tr>
      </tbody>
    </table>
  )
}

export function SessionNoteDocument({
  clientName,
  dateOfBirth,
  sessionDate,
  sessionTime,
  therapeuticTarget,
  btpTargets,
  assessments,
  asqResult,
  crisisPlan,
  practitionerNotes,
  nextAppointment,
  practitionerName,
  practitionerTitle,
}: {
  clientName: string
  dateOfBirth: string | null
  sessionDate: string
  sessionTime: string | null
  therapeuticTarget: string | null
  btpTargets: SessionNoteBtpTarget[]
  assessments: SessionNoteAssessmentResult[]
  asqResult: SessionNoteAsqResult
  crisisPlan: SessionNoteCrisisPlanInfo
  practitionerNotes: string | null
  nextAppointment: SessionNoteNextAppointment
  practitionerName: string
  practitionerTitle: string | null
}) {
  const practitionerLine = [practitionerTitle, practitionerName]
    .filter(Boolean)
    .join(" ")

  return (
    <article className="session-note-document mx-auto max-w-3xl bg-white text-foreground">
      <header className="session-note-header space-y-3 border-b pb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Session Note</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-muted-foreground">Client</dt>
            <dd>{clientName}</dd>
            <dd className="text-muted-foreground">
              Date of birth: {formatDob(dateOfBirth)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Session</dt>
            <dd>{formatSessionNoteDate(sessionDate)}</dd>
            <dd className="text-muted-foreground">
              {formatSessionNoteTime(sessionTime)}
            </dd>
          </div>
        </dl>
      </header>

      <section className="session-note-section pt-4">
        <h3 className="mb-2 text-base font-semibold">Treatment Plan</h3>
        <div className="mb-3">
          <p className="text-sm font-medium text-muted-foreground">
            Therapeutic target
          </p>
          <p className="text-sm">{therapeuticTarget || "No treatment plan"}</p>
        </div>
        <BtpTable targets={btpTargets} />
      </section>

      <section className="session-note-section">
        <h3 className="mb-3 text-base font-semibold">Ongoing Assessments</h3>
        <div className="space-y-4">
          {assessments.map((result) => (
            <div key={result.code}>
              <h4 className="mb-1 text-sm font-medium">{result.name}</h4>
              <AssessmentBlock result={result} />
            </div>
          ))}
        </div>
      </section>

      <section className="session-note-section">
        <h3 className="mb-2 text-base font-semibold">Risk Assessment</h3>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium">ASQ</p>
            {asqResult ? (
              <table className="report-results-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Screen outcome</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{asqResult.score}</td>
                    <td>{asqResult.acuteRiskRating ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground">No ASQ administered this session.</p>
            )}
          </div>
          <div>
            <p className="font-medium">Crisis Plan</p>
            {crisisPlan ? (
              <p>
                Active plan v{crisisPlan.versionNumber} (
                {formatSessionNoteDate(crisisPlan.dateOfPlan)}) —{" "}
                {crisisPlan.updatedThisSession
                  ? "Updated this session"
                  : "Not updated"}
              </p>
            ) : (
              <p className="text-muted-foreground">No active crisis plan.</p>
            )}
          </div>
        </div>
      </section>

      <section className="session-note-section">
        <h3 className="mb-2 text-base font-semibold">Practitioner Notes</h3>
        <p className="whitespace-pre-wrap text-sm">
          {practitionerNotes?.trim() || "—"}
        </p>
      </section>

      <section className="session-note-section">
        <h3 className="mb-2 text-base font-semibold">Next Appointment</h3>
        <p className="text-sm">
          {nextAppointment?.label ?? "No upcoming appointment"}
        </p>
      </section>

      <footer className="session-note-signature pt-6">
        <p className="text-sm text-muted-foreground">Practitioner signature</p>
        <div className="mt-10 border-b border-foreground/40" />
        <p className="mt-2 text-sm">{practitionerLine || "—"}</p>
      </footer>
    </article>
  )
}
