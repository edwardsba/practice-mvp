/**
 * Where each practitioner assessment opens from the Start page.
 * All practitioner assessments that canCompleteInSharedForm use the shared
 * form. LEGACY_START must stay empty — legacy MSE/ASQ pages remain on disk
 * unlinked until Round AI removes them.
 */

export type PractitionerStartTarget =
  | { kind: "legacy"; pathSuffix: string }
  | { kind: "shared" }

/** Must remain empty. Guard self-test fails if any code is listed here. */
const LEGACY_START: Record<string, string> = {}

/**
 * Client-completable codes that must not use the shared practitioner form yet.
 * BTP: questions are built from SMART goals at send time.
 * BACKGROUND_SR: own questionnaire / results path.
 * MSE and ASQ are practitioner-only and use the shared form (not listed here).
 */
const SHARED_FORM_EXCLUDED_CLIENT_CODES = [
  "BTP",
  "BACKGROUND_SR",
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
 * definition: practitioner-only non-legacy instruments (LRAMP, ASQ, mse), and
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
    // Practitioner-only, non-legacy (LRAMP, ASQ, mse).
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
 * True for practitioner-only, non-legacy assessments (LRAMP, ASQ, mse).
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

/** Exported for the shared-form guard self-test only. */
export function legacyStartEntriesForGuard(): Record<string, string> {
  return { ...LEGACY_START }
}
