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

function ObjectiveMeasuresTable({
  assessments,
}: {
  assessments: SessionNoteAssessmentResult[]
}) {
  const completed = assessments.filter((result) => result.assessmentResultId)

  if (completed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No objective measures completed this session.
      </p>
    )
  }

  return (
    <table className="report-results-table w-full text-sm">
      <thead>
        <tr>
          <th>Assessment</th>
          <th>Score</th>
          <th>Rating</th>
          <th>Functional Impairment</th>
        </tr>
      </thead>
      <tbody>
        {completed.map((result) => (
          <tr key={result.code}>
            <td>{result.name}</td>
            <td>
              {result.score}
              {result.maxScore != null ? `/${result.maxScore}` : ""}
            </td>
            <td className="capitalize">{result.severity ?? "—"}</td>
            <td>{result.functionalImpairmentLabel ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RiskAssessmentTable({
  asqResult,
  crisisPlan,
}: {
  asqResult: SessionNoteAsqResult
  crisisPlan: SessionNoteCrisisPlanInfo
}) {
  return (
    <>
      {asqResult ? (
        <table className="report-results-table w-full text-sm">
          <thead>
            <tr>
              <th>Assessment</th>
              <th>Score</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ASQ</td>
              <td>{asqResult.score}/5</td>
              <td>{asqResult.acuteRiskRating ?? "—"}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">
          No ASQ administered this session.
        </p>
      )}
      <p className="text-sm">
        Current crisis plan:{" "}
        {crisisPlan
          ? `v${crisisPlan.versionNumber}, ${formatSessionNoteDate(crisisPlan.dateOfPlan)}`
          : "—"}
      </p>
    </>
  )
}

function TreatmentPlanProgress({
  therapeuticTarget,
  btpTargets,
}: {
  therapeuticTarget: string | null
  btpTargets: SessionNoteBtpTarget[]
}) {
  return (
    <>
      <p className="text-sm">
        Therapeutic target: {therapeuticTarget || "No treatment plan"}
      </p>
      {btpTargets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No behavioural target results for this session.
        </p>
      ) : (
        <table className="report-results-table w-full text-sm">
          <thead>
            <tr>
              <th>Behavioural Target</th>
              <th>Score</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {btpTargets.map((row) => (
              <tr key={row.target}>
                <td>{row.target}</td>
                <td>{row.score}/5</td>
                <td>{row.ratingLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
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
      <h2 className="text-lg font-bold">Confidential Session Note</h2>

      <div className="session-note-meta text-sm">
        <p>
          <span className="font-medium">Client:</span> {clientName} (DOB:{" "}
          {formatDob(dateOfBirth)})
        </p>
        <p>
          <span className="font-medium">Session:</span>{" "}
          {formatSessionNoteDate(sessionDate)}, {formatSessionNoteTime(sessionTime)}
        </p>
      </div>

      <h3 className="session-note-label">Objective Measures</h3>
      <ObjectiveMeasuresTable assessments={assessments} />

      <h3 className="session-note-label">Risk Assessment</h3>
      <RiskAssessmentTable asqResult={asqResult} crisisPlan={crisisPlan} />

      <h3 className="session-note-label">Treatment Plan Progress</h3>
      <TreatmentPlanProgress
        therapeuticTarget={therapeuticTarget}
        btpTargets={btpTargets}
      />

      <h3 className="session-note-label">Notes</h3>
      <p className="whitespace-pre-wrap text-sm">
        {practitionerNotes?.trim() || "—"}
      </p>

      <p className="text-sm">
        <span className="italic">Next Appointment</span>{" "}
        {nextAppointment?.label ?? "No upcoming appointment"}
      </p>

      <footer className="session-note-signature">
        <p className="text-sm text-muted-foreground">Practitioner signature</p>
        <div className="session-note-signature-line" />
        <p className="text-sm">{practitionerLine || "—"}</p>
      </footer>
    </article>
  )
}
