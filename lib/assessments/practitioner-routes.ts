/**
 * Where each practitioner assessment opens from the Start page.
 * Keep MSE on its existing route until it moves onto the shared form —
 * then delete that line. ASQ uses the shared form.
 */

export type PractitionerStartTarget =
  | { kind: "legacy"; pathSuffix: string }
  | { kind: "shared" }

const LEGACY_START: Record<string, string> = {
  mse: "mse/new",
}

/**
 * Client-completable codes that must not use the shared practitioner form yet.
 * BTP: questions are built from SMART goals at send time.
 * BACKGROUND_SR: own questionnaire / results path.
 * mse: legacy practitioner page (also listed in LEGACY_START).
 * ASQ is practitioner-only and uses the shared form (not listed here).
 */
const SHARED_FORM_EXCLUDED_CLIENT_CODES = [
  "BTP",
  "BACKGROUND_SR",
  "mse",
] as const

export type SharedFormDefinitionGate = {
  assessmentCode: string
  clientCompletable: boolean
  practitionerCompletable: boolean
  isActive: boolean
  hasActiveElements: boolean
}

/**
 * True when the shared practitioner form (new/edit + save) may complete this
 * definition: practitioner-only non-legacy instruments (LRAMP today), and
 * active client questionnaires that are also practitioner-completable with
 * elements — except the excluded codes above.
 */
export function canCompleteInSharedForm(
  def: SharedFormDefinitionGate
): boolean {
  if (!def.isActive) return false
  if (!def.hasActiveElements) return false
  if (!def.practitionerCompletable) return false
  if (def.assessmentCode in LEGACY_START) return false

  if (!def.clientCompletable) {
    // Practitioner-only, non-legacy (LRAMP).
    return true
  }

  if (
    (SHARED_FORM_EXCLUDED_CLIENT_CODES as readonly string[]).includes(
      def.assessmentCode
    )
  ) {
    return false
  }

  return true
}

/**
 * True for practitioner-only, non-legacy assessments (LRAMP, ASQ).
 * Shared early Results branch (summary box + answer sections); scored
 * client questionnaires keep the default Results layout.
 */
export function usesSharedResultsLayout(params: {
  assessmentCode: string
  clientCompletable: boolean
  practitionerCompletable: boolean
}): boolean {
  if (!params.practitionerCompletable) return false
  if (params.clientCompletable) return false
  if (params.assessmentCode in LEGACY_START) return false
  return true
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
