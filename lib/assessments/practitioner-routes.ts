/**
 * Where each practitioner assessment opens from the Start page.
 * Keep ASQ/MSE on their existing routes until they move onto the shared form —
 * then delete one line each.
 */

export type PractitionerStartTarget =
  | { kind: "legacy"; pathSuffix: string }
  | { kind: "shared" }

const LEGACY_START: Record<string, string> = {
  ASQ: "asq/new",
  mse: "mse/new",
}

export function practitionerStartTarget(
  assessmentCode: string
): PractitionerStartTarget {
  const legacy = LEGACY_START[assessmentCode]
  if (legacy) {
    return { kind: "legacy", pathSuffix: legacy }
  }
  return { kind: "shared" }
}

export function buildPractitionerStartHref(params: {
  clientId: string
  assessmentCode: string
  sessionNoteId: string | null
  returnTo: string
}): string {
  const { clientId, assessmentCode, sessionNoteId, returnTo } = params
  const target = practitionerStartTarget(assessmentCode)
  const query = new URLSearchParams()
  if (sessionNoteId) query.set("session_note_id", sessionNoteId)
  query.set("returnTo", returnTo)
  const qs = query.toString()

  if (target.kind === "legacy") {
    return `/clients/${clientId}/${target.pathSuffix}?${qs}`
  }

  return `/clients/${clientId}/assessments/new/${encodeURIComponent(assessmentCode)}?${qs}`
}

export function buildPractitionerEditHref(params: {
  clientId: string
  instanceId: string
  returnTo: string
}): string {
  const query = new URLSearchParams()
  query.set("returnTo", params.returnTo)
  return `/clients/${params.clientId}/assessments/edit/${params.instanceId}?${query.toString()}`
}
