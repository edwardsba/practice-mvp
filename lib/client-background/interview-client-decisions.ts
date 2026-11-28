/**
 * Use client's / Keep, and "Accept N client changes and confirm", for Background interview
 * sections 3 and 7 (Round AR). Every value written comes from the stored self-report the server
 * loaded (`suggestions`); the browser only names the fields it showed.
 * Pure — no database.
 */

import type { ClientBackgroundSuggestions } from "@/lib/background-questionnaire/to-client-background"
import {
  answerQuestionsFirstLabel,
  confirmSectionAnswers,
  detailsItemsInSection,
  INTERVIEW_SECTIONS,
  setClientDecision,
  unansweredQuestionCount,
  type InterviewAnswersJson,
} from "@/lib/client-background/interview-answers"
import {
  applyClientField,
  clientFieldStates,
  compareClientField,
  isClientFieldKey,
  sectionNumbersForClientFields,
  waitingClientFieldsForSection,
  type ClientFieldKey,
  type ClientFieldSection,
} from "@/lib/client-background/interview-client-fields"
import { demographicDetailPresence } from "@/lib/client-background/interview-detail-presence"
import type { Demographics, RelationshipRecord } from "@/lib/client-background/types"

export const SELF_REPORT_CHANGED_ERROR =
  "The client's self-report has changed since this page loaded. Reload the page and try again."
export const CLIENT_CHANGES_CHANGED_ERROR =
  "The client's answers waiting in this section have changed. Reload the page and try again."

export type ClientDecisionResult =
  | {
      ok: true
      answers: InterviewAnswersJson
      demographics: Demographics
      /** Demographics sections to save (empty for Keep, or when the answer was already on file). */
      changedSections: ClientFieldSection[]
    }
  | { ok: false; error: string }

/** One row's Use client's or Keep. */
export function decideClientField(input: {
  answers: InterviewAnswersJson
  demographics: Demographics
  suggestions: ClientBackgroundSuggestions | null
  fieldKey: unknown
  choice: unknown
  at: string
}): ClientDecisionResult {
  if (!isClientFieldKey(input.fieldKey)) return { ok: false, error: "Unknown client answer." }
  if (input.choice !== "used" && input.choice !== "kept") {
    return { ok: false, error: "Choose Use client's or Keep." }
  }
  const fieldKey = input.fieldKey
  const compared = compareClientField(fieldKey, input.suggestions, input.demographics)
  if (!compared) return { ok: false, error: "The client didn't answer this in the self-report." }
  const unchanged = { ok: true as const, demographics: input.demographics, changedSections: [] }
  if (input.choice === "kept") {
    return { ...unchanged, answers: setClientDecision(input.answers, fieldKey, "kept", input.at) }
  }
  // Already on file (e.g. a second tap): record the choice, write nothing.
  if (compared.kind === "same") {
    return { ...unchanged, answers: setClientDecision(input.answers, fieldKey, "used", input.at) }
  }
  const applied = applyClientField(fieldKey, input.suggestions, input.demographics)
  if (!applied.ok) return applied
  return {
    ok: true,
    answers: setClientDecision(input.answers, fieldKey, "used", input.at),
    demographics: applied.demographics,
    changedSections: [applied.section],
  }
}

export type AcceptClientChangesResult =
  | {
      ok: true
      /** Decisions recorded and the section confirmed. */
      answers: InterviewAnswersJson
      demographics: Demographics
      appliedFieldKeys: ClientFieldKey[]
      changedSections: ClientFieldSection[]
    }
  | { ok: false; error: string }

/**
 * Use client's for every field still waiting in the section, then confirm it. Refuses while a
 * question is unanswered, and when the waiting fields aren't the ones the browser showed.
 */
export function acceptClientChangesAndConfirm(input: {
  answers: InterviewAnswersJson
  demographics: Demographics
  suggestions: ClientBackgroundSuggestions | null
  relationships: readonly RelationshipRecord[]
  sectionNumber: number
  /** From the browser, for details outside the demographics record. */
  detailHasValue: Readonly<Record<string, boolean>>
  /** Field names the browser showed as waiting. Never values. */
  expectedFieldKeys: readonly unknown[]
  at: string
}): AcceptClientChangesResult {
  const section = INTERVIEW_SECTIONS.find((item) => item.number === input.sectionNumber)
  if (!section || !sectionNumbersForClientFields().includes(section.number)) {
    return { ok: false, error: "Unknown interview section." }
  }
  const unanswered = unansweredQuestionCount(section, input.answers)
  if (unanswered > 0) return { ok: false, error: answerQuestionsFirstLabel(unanswered) }

  const waiting = waitingClientFieldsForSection(
    clientFieldStates(input.suggestions, input.demographics, input.answers.clientDecisions),
    section.number
  ).map((state) => state.fieldKey)
  const expected = new Set(input.expectedFieldKeys.filter(isClientFieldKey))
  if (
    expected.size !== input.expectedFieldKeys.length ||
    expected.size !== waiting.length ||
    waiting.some((fieldKey) => !expected.has(fieldKey))
  ) {
    return { ok: false, error: CLIENT_CHANGES_CHANGED_ERROR }
  }

  let demographics = input.demographics
  let answers = input.answers
  const changed = new Set<ClientFieldSection>()
  for (const fieldKey of waiting) {
    const applied = applyClientField(fieldKey, input.suggestions, demographics)
    if (!applied.ok) return { ok: false, error: applied.error }
    demographics = applied.demographics
    changed.add(applied.section)
    answers = setClientDecision(answers, fieldKey, "used", input.at)
  }

  const onRecord = demographicDetailPresence(demographics, input.relationships)
  const detailHasValue: Record<string, boolean> = { ...input.detailHasValue }
  for (const item of detailsItemsInSection(section)) {
    if (item.key in onRecord) detailHasValue[item.key] = onRecord[item.key]
  }
  const confirmed = confirmSectionAnswers(answers, section.number, detailHasValue, [], input.at)
  if (!confirmed.ok) return { ok: false, error: confirmed.error }
  return {
    ok: true,
    answers: confirmed.answers,
    demographics,
    appliedFieldKeys: waiting,
    changedSections: [...changed],
  }
}
