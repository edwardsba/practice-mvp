/**
 * ASQ result summary rows for the shared practitioner results layout.
 */

import type { FormAnswers, FormElement } from "@/lib/assessments/form-rules"
import type { ResultSummaryLine } from "@/lib/assessments/lramp-summary"

export type AsqResultSummaryExtras = {
  /** Stored assessment_results.severity (screen outcome). */
  severity?: string | null
  /** Stored assessment_results.acute_risk_rating — shown only when set. */
  acuteRiskRating?: string | null
}

const ASQ_QUESTION_KEYS = [
  "asq_q1",
  "asq_q2",
  "asq_q3",
  "asq_q4",
  "asq_q5",
] as const

function countYesAnswers(answers: FormAnswers): number {
  let yes = 0
  for (const key of ASQ_QUESTION_KEYS) {
    if (answers[key]?.[0] === "yes") yes += 1
  }
  return yes
}

/**
 * Summary box rows for an ASQ result.
 * Screen outcome uses the stored severity; Yes count is derived from answers.
 */
export function asqResultSummary(
  answers: FormAnswers,
  _elements: FormElement[],
  extras?: AsqResultSummaryExtras
): ResultSummaryLine[] {
  const yesCount = countYesAnswers(answers)
  const rows: ResultSummaryLine[] = [
    {
      label: "Screen outcome",
      value: extras?.severity?.trim() ? extras.severity : "—",
    },
    {
      label: "Questions answered Yes",
      value: `${yesCount} of 5`,
    },
  ]

  const acute = extras?.acuteRiskRating?.trim()
  if (acute) {
    rows.push({
      label: "Acute risk rating",
      value: acute,
    })
  }

  return rows
}
