/**
 * Where each practitioner assessment opens from the Start page.
 * All assessments that canCompleteInSharedForm use the shared practitioner form.
 */

/**
 * Client-completable codes that must not use the shared practitioner form yet.
 * BTP: questions are built from SMART goals at send time.
 * BACKGROUND_SR is client-only (practitioner_completable false) so it never reaches
 * canCompleteInSharedForm — listed only if that flag changes.
 * MSE and ASQ are practitioner-only and use the shared form (not listed here).
 */
const SHARED_FORM_EXCLUDED_CLIENT_CODES = [
  "BTP",
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
 * definition: practitioner-only instruments (LRAMP, ASQ, mse), and active
 * client questionnaires that are also practitioner-completable with elements
 * — except the excluded codes above.
 */
export function canCompleteInSharedForm(
  def: SharedFormDefinitionGate
): boolean {
  if (!def.isActive) return false
  if (!def.hasActiveElements) return false
  if (!def.practitionerCompletable) return false

  if (!def.clientCompletable) {
    // Practitioner-only (LRAMP, ASQ, mse).
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
 * True for practitioner-only assessments (LRAMP, ASQ, mse).
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
  return true
}

export function buildPractitionerStartHref(params: {
  clientId: string
  assessmentCode: string
  sessionNoteId: string | null
  returnTo: string
}): string {
  const { clientId, assessmentCode, sessionNoteId, returnTo } = params
  const query = new URLSearchParams()
  if (sessionNoteId) query.set("session_note_id", sessionNoteId)
  query.set("returnTo", returnTo)
  const qs = query.toString()

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
