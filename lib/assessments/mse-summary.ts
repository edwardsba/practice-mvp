/**
 * MSE result summary for the shared practitioner results layout.
 * One line: the session-note sentence (same engine as the note and letters).
 */

import type { FormAnswers, FormElement } from "@/lib/assessments/form-rules"
import type { ResultSummaryLine } from "@/lib/assessments/lramp-summary"
import {
  buildMseSessionNoteSentence,
  MSE_ELEMENT_KEY_TO_FIELD,
  type MseSessionNoteResponses,
} from "@/lib/mse/session-note-sentence"

export function buildMseResponsesFromAnswers(
  answers: FormAnswers,
  elements: FormElement[]
): MseSessionNoteResponses {
  const responses: MseSessionNoteResponses = {}
  for (const element of elements) {
    const fieldKey = MSE_ELEMENT_KEY_TO_FIELD[element.elementKey]
    if (!fieldKey) continue
    const value = answers[element.elementKey]?.[0]
    if (!value) continue
    const option = element.options.find((o) => o.value === value)
    if (!option) continue
    responses[fieldKey] = {
      optionLabel: option.label,
      isReportingBaseline: Boolean(option.isReportingBaseline),
    }
  }
  return responses
}

/**
 * Summary box rows for an MSE result — one narrative line, no extra score line.
 * Empty label so the shared box renders the sentence full-width under Summary.
 */
export function mseResultSummary(
  answers: FormAnswers,
  elements: FormElement[]
): ResultSummaryLine[] {
  const sentence = buildMseSessionNoteSentence(
    buildMseResponsesFromAnswers(answers, elements)
  ).trim()
  if (!sentence) return []
  return [{ label: "", value: sentence }]
}
