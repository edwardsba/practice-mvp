/**
 * Pure helpers for the Assessments › Start page list and today's session note.
 */

export type StartListDefinition = {
  assessmentCode: string
  assessmentName: string
  clientCompletable: boolean
  practitionerCompletable: boolean
  elementCount: number
  isActive: boolean
}

export type StartListRow = {
  assessmentCode: string
  assessmentName: string
  enabled: boolean
  section: "practitioner" | "client"
}

export type SessionNoteForStart = {
  sessionNoteId: string
  sessionDate: string
}

/**
 * Practitioner section: active, practitioner_completable, not client_completable,
 * with elements — sorted A–Z by code (ASQ, LRAMP, mse…).
 * Client section: every other active definition with elements, A–Z, disabled.
 */
export function buildStartAssessmentList(
  definitions: StartListDefinition[]
): { practitioner: StartListRow[]; client: StartListRow[] } {
  const withElements = definitions.filter(
    (d) => d.isActive && d.elementCount > 0
  )

  const practitioner = withElements
    .filter((d) => d.practitionerCompletable && !d.clientCompletable)
    .map(
      (d): StartListRow => ({
        assessmentCode: d.assessmentCode,
        assessmentName: d.assessmentName,
        enabled: true,
        section: "practitioner",
      })
    )
    .sort((a, b) =>
      a.assessmentCode.localeCompare(b.assessmentCode, "en", {
        sensitivity: "base",
      })
    )

  const practitionerCodes = new Set(practitioner.map((r) => r.assessmentCode))

  const client = withElements
    .filter((d) => !practitionerCodes.has(d.assessmentCode))
    .map(
      (d): StartListRow => ({
        assessmentCode: d.assessmentCode,
        assessmentName: d.assessmentName,
        enabled: false,
        section: "client",
      })
    )
    .sort((a, b) =>
      a.assessmentCode.localeCompare(b.assessmentCode, "en", {
        sensitivity: "base",
      })
    )

  return { practitioner, client }
}

/**
 * Attach to today's session note only when exactly one note exists for the
 * client with session_date = today (Sydney). Zero or two+ → no attachment.
 */
export function chooseTodaysSessionNote(
  notes: SessionNoteForStart[],
  todayDate: string
): SessionNoteForStart | null {
  const todays = notes.filter((note) => note.sessionDate === todayDate)
  if (todays.length !== 1) return null
  return todays[0]
}

export function startAttachmentLine(
  note: SessionNoteForStart | null,
  todayDate: string
): string {
  if (!note) return "Not attached to a session note"
  return `Will attach to today's session note (${todayDate})`
}
