/**
 * Pure helpers for the shared-form client submit path (`/api/assessments/submit-form`).
 * Maps browser answers by elementKey against the server definition — never trusts
 * element IDs or scores from the client.
 */

import {
  cleanAnswers,
  toResponseRows,
  validateAnswers,
  type FormAnswers,
  type FormElement,
  type FormResponseRow,
  type FormValidationError,
} from "@/lib/assessments/form-rules"

export type PrepareClientFormSubmissionResult =
  | {
      ok: true
      answers: FormAnswers
      rows: FormResponseRow[]
    }
  | {
      ok: false
      errors: FormValidationError[]
    }

/**
 * Drop unknown / hidden keys (via cleanAnswers), refuse invalid options, and
 * produce storage rows. Caller maps elementKey → assessmentElementId from the
 * server-loaded definition.
 */
export function prepareClientFormSubmission(
  elements: FormElement[],
  rawAnswers: FormAnswers
): PrepareClientFormSubmissionResult {
  const cleaned = cleanAnswers(elements, rawAnswers)
  const errors = validateAnswers(elements, cleaned)
  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    answers: cleaned,
    rows: toResponseRows(elements, cleaned),
  }
}
