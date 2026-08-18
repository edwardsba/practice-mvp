import { db } from "@/lib/db"
import { sageSrPersonalityCriteriaReference } from "@/db/schema"

import type { SageSrPersonalityResponseItem } from "./parse-personality-response"

/** The five standard SAGE-SR Likert response labels, in scale order. Any response value
 *  outside this set (a skipped item, an onset-only "Yes"/"No" follow-up that shouldn't be
 *  reaching this function at all, or anything unrecognized) is treated as not satisfying
 *  any criterion — conservative by design, since an unrecognized value is more likely a
 *  data issue than a genuine endorsement. */
const LIKERT_SCALE = ["Never", "Rarely", "Sometimes", "Often", "Always"] as const
type LikertResponse = (typeof LIKERT_SCALE)[number]

function isLikertResponse(value: string): value is LikertResponse {
  return (LIKERT_SCALE as readonly string[]).includes(value)
}

/** Per Ben's clinical call: because these behaviors are uncommon in a non-clinical
 *  population, only the fully non-clinical end of an item's scale fails to satisfy its
 *  criterion — not just the top of the scale. For a standard item, Sometimes/Often/Always
 *  all satisfy; only Never/Rarely don't. For a reverse-scored item (where the pathological
 *  direction is the LOW end of the scale, e.g. "I forgave people who insulted me"),
 *  Never/Rarely/Sometimes all satisfy; only Often/Always don't. */
function isCriterionSatisfyingResponse(response: string, reverseScored: boolean): boolean {
  if (!isLikertResponse(response)) return false
  const index = LIKERT_SCALE.indexOf(response)
  return reverseScored ? index <= 2 : index >= 2
}

export interface SageSrPersonalityCriterionReferenceRow {
  disorder: string
  criterionNumber: number
  criterionText: string
  thresholdRequired: number
  totalCriteria: number
  itemText: string
  reverseScored: boolean
  notes: string | null
}

export interface SageSrPersonalityCriterionMatchedItem {
  itemText: string
  response: string | null // null if this item wasn't found anywhere in the client's Response Report data at all
  reverseScored: boolean
  satisfying: boolean
}

export interface SageSrPersonalityCriterionResult {
  criterionNumber: number
  criterionText: string
  satisfied: boolean
  matchedItems: SageSrPersonalityCriterionMatchedItem[]
}

export interface SageSrPersonalityDisorderScore {
  disorder: string
  thresholdRequired: number
  totalCriteria: number
  criteriaMet: number
  meetsThreshold: boolean
  criteria: SageSrPersonalityCriterionResult[]
}

/**
 * Pure scoring logic, separated from the database fetch below so it can be exercised
 * directly against known response data without needing a live database connection.
 * Verified during development against the real Test01 Personality Response Report,
 * cross-checking every one of the 117 reference rows' itemText for an exact match
 * against the actual parser's real output (this is what caught the two item-text
 * corrections in db/fix-sage-sr-personality-criteria-reference-item-text.ts) and
 * confirming the computed criteria-met counts for all 10 disorders.
 *
 * "Satisfied" is used throughout rather than "endorsed", per Ben's terminology: the
 * client's answers satisfied criteria for a disorder, not that they endorsed items.
 *
 * A criterion is satisfied if ANY of its mapped items (there can be more than one row per
 * disorder + criterionNumber) has a satisfying response — not all of them. A disorder's
 * criteriaMet count is the number of DISTINCT criterion numbers satisfied, not the number
 * of individual items satisfied.
 *
 * A reference item with no corresponding entry anywhere in the client's Response Report
 * data (response: null below) simply doesn't satisfy its criterion — this is the normal,
 * expected case for a skipped question, not an error. It's surfaced in the result (rather
 * than silently omitted) so a caller building a detailed view can distinguish "asked and
 * answered non-satisfyingly" from "not found in this client's data at all".
 */
export function computeSageSrPersonalityCriteriaScores(
  referenceRows: SageSrPersonalityCriterionReferenceRow[],
  responses: SageSrPersonalityResponseItem[]
): SageSrPersonalityDisorderScore[] {
  const responseByItemText = new Map<string, string>()
  for (const r of responses) {
    // Response Report items sometimes wrap and re-parse the same item text via the shared
    // parser's own dedup logic before this function ever sees them, so a plain Map is safe
    // here — first occurrence wins if a literal duplicate somehow appears.
    if (!responseByItemText.has(r.item)) responseByItemText.set(r.item, r.response)
  }

  // Group reference rows by disorder, then by criterion number, preserving first-seen
  // order for both — keeps output stable and matches the seed data's own ordering rather
  // than whatever order the database happens to return rows in.
  const disorderOrder: string[] = []
  const rowsByDisorder = new Map<string, SageSrPersonalityCriterionReferenceRow[]>()
  for (const row of referenceRows) {
    if (!rowsByDisorder.has(row.disorder)) {
      rowsByDisorder.set(row.disorder, [])
      disorderOrder.push(row.disorder)
    }
    rowsByDisorder.get(row.disorder)!.push(row)
  }

  const results: SageSrPersonalityDisorderScore[] = []

  for (const disorder of disorderOrder) {
    const disorderRows = rowsByDisorder.get(disorder)!
    const { thresholdRequired, totalCriteria } = disorderRows[0]

    const criterionOrder: number[] = []
    const rowsByCriterion = new Map<number, SageSrPersonalityCriterionReferenceRow[]>()
    for (const row of disorderRows) {
      if (!rowsByCriterion.has(row.criterionNumber)) {
        rowsByCriterion.set(row.criterionNumber, [])
        criterionOrder.push(row.criterionNumber)
      }
      rowsByCriterion.get(row.criterionNumber)!.push(row)
    }

    const criteria: SageSrPersonalityCriterionResult[] = criterionOrder.map((criterionNumber) => {
      const rows = rowsByCriterion.get(criterionNumber)!
      const matchedItems: SageSrPersonalityCriterionMatchedItem[] = rows.map((row) => {
        const response = responseByItemText.get(row.itemText) ?? null
        if (response === null) {
          console.warn(
            `SAGE-SR personality scoring: no response found for reference item "${row.itemText}" (${disorder}, criterion ${criterionNumber}) — either this client's import doesn't include this item, or the reference table's wording has drifted from the real item text.`
          )
        }
        return {
          itemText: row.itemText,
          response,
          reverseScored: row.reverseScored,
          satisfying: response !== null && isCriterionSatisfyingResponse(response, row.reverseScored),
        }
      })
      return {
        criterionNumber,
        criterionText: rows[0].criterionText,
        satisfied: matchedItems.some((m) => m.satisfying),
        matchedItems,
      }
    })

    const criteriaMet = criteria.filter((c) => c.satisfied).length

    results.push({
      disorder,
      thresholdRequired,
      totalCriteria,
      criteriaMet,
      meetsThreshold: criteriaMet >= thresholdRequired,
      criteria,
    })
  }

  return results
}

/**
 * Fetches the reference table and scores a client's actual Personality Response Report
 * answers against it. This is the function results-page/report code should call — it
 * always reflects the current state of sage_sr_personality_criteria_reference, since
 * scoring is computed live at render time rather than stored at import (deliberate,
 * per Ben: the reference table is still actively being corrected, and all data is test
 * data for now — revisit storing this at import time once the mapping has settled and
 * real client history exists worth preserving through a correction).
 */
export async function scoreSageSrPersonalityCriteria(
  responses: SageSrPersonalityResponseItem[]
): Promise<SageSrPersonalityDisorderScore[]> {
  const referenceRows = await db
    .select({
      disorder: sageSrPersonalityCriteriaReference.disorder,
      criterionNumber: sageSrPersonalityCriteriaReference.criterionNumber,
      criterionText: sageSrPersonalityCriteriaReference.criterionText,
      thresholdRequired: sageSrPersonalityCriteriaReference.thresholdRequired,
      totalCriteria: sageSrPersonalityCriteriaReference.totalCriteria,
      itemText: sageSrPersonalityCriteriaReference.itemText,
      reverseScored: sageSrPersonalityCriteriaReference.reverseScored,
      notes: sageSrPersonalityCriteriaReference.notes,
    })
    .from(sageSrPersonalityCriteriaReference)

  return computeSageSrPersonalityCriteriaScores(referenceRows, responses)
}
