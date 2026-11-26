/**
 * Pure MSE noted-count rule — one source for scoring, Score column helpers,
 * and backfill self-tests. No database.
 *
 * Noted = answer whose option is not the reporting baseline,
 * except Insight and Judgement, where only "Poor" counts (Fair and Good do not).
 */

export type MseNotedAnswer = {
  elementKey: string
  optionLabel: string
  isReportingBaseline: boolean
}

export type MseNotedStructuredScore = {
  notedCount: number
  notedElementKeys: string[]
}

export type MseNotedResult = {
  notedCount: number
  notedElementKeys: string[]
  /** "Within limits" when count is 0, otherwise "N noted". */
  severity: string
  structuredScoreJson: MseNotedStructuredScore
}

const INSIGHT_JUDGEMENT_KEYS = new Set(["mse_insight", "mse_judgement"])

/** True when this answer contributes to the noted count. */
export function isMseAnswerNoted(answer: MseNotedAnswer): boolean {
  if (INSIGHT_JUDGEMENT_KEYS.has(answer.elementKey)) {
    return answer.optionLabel === "Poor"
  }
  return !answer.isReportingBaseline
}

export function mseSeverityFromNotedCount(notedCount: number): string {
  if (notedCount <= 0) return "Within limits"
  return `${notedCount} noted`
}

/**
 * Compute noted count, element keys (in input order), severity text, and
 * structured_score_json for an MSE result row.
 */
export function scoreMseNoted(answers: MseNotedAnswer[]): MseNotedResult {
  const notedElementKeys = answers
    .filter(isMseAnswerNoted)
    .map((answer) => answer.elementKey)
  const notedCount = notedElementKeys.length
  const severity = mseSeverityFromNotedCount(notedCount)
  return {
    notedCount,
    notedElementKeys,
    severity,
    structuredScoreJson: {
      notedCount,
      notedElementKeys,
    },
  }
}
