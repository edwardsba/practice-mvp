import {
  STRESSOR_ITEMS,
  type EventRecord,
  type EventType,
  type HistoryIssue,
  type StressorsRecord,
  type TreatmentAnswer,
} from "@/lib/client-background/types"

export const HISTORY_QUESTION_GROUPS = [
  {
    title: "Client history",
    keys: [
      "illness_injury",
      "substance_use",
      "emotional_problems",
      "self_harm",
      "traumatic_events",
      "other_significant_events",
    ],
  },
  {
    title: "Significant other history",
    keys: [
      "family_illness",
      "family_substance_use",
      "family_emotional_problems",
      "family_self_harm",
      "family_significant_events",
    ],
  },
] as const

export const HISTORY_QUESTION_KEYS = HISTORY_QUESTION_GROUPS.flatMap((group) => group.keys)

export type HistoryQuestionKey = (typeof HISTORY_QUESTION_KEYS)[number]

/** Screening answers. Retired keys (hospital admission, therapy, medication, other_treatment) are ignored on read. */
export type ScreeningQuestionKey = HistoryQuestionKey

export const SCREENING_ANSWERS = ["yes", "no", "not_asked"] as const
export type ScreeningAnswer = (typeof SCREENING_ANSWERS)[number]
export type ScreeningAnswers = Partial<Record<ScreeningQuestionKey, ScreeningAnswer>>

export type HistoryQuestionGroup = (typeof HISTORY_QUESTION_GROUPS)[number]

type QuestionDefinition = {
  key: HistoryQuestionKey
  label: string
  eventType: EventType | null
  about: "self" | "significant_other"
  /** Condition categories have an issue level; event categories are Category → event. */
  mode: "condition" | "event"
}

const SCREENING_QUESTION_KEYS = HISTORY_QUESTION_KEYS

export const HISTORY_QUESTIONS: Record<HistoryQuestionKey, QuestionDefinition> = {
  illness_injury: {
    key: "illness_injury",
    label: "Physical health",
    eventType: "illness_injury",
    about: "self",
    mode: "condition",
  },
  substance_use: {
    key: "substance_use",
    label: "Substance use",
    eventType: "substance_use",
    about: "self",
    mode: "condition",
  },
  emotional_problems: {
    key: "emotional_problems",
    label: "Mental health",
    eventType: "emotional_problems",
    about: "self",
    mode: "condition",
  },
  self_harm: {
    key: "self_harm",
    label: "Self-harm",
    eventType: "self_harm",
    about: "self",
    mode: "event",
  },
  traumatic_events: {
    key: "traumatic_events",
    label: "Traumatic events",
    eventType: "traumatic_event",
    about: "self",
    mode: "event",
  },
  other_significant_events: {
    key: "other_significant_events",
    label: "Other significant events",
    eventType: "significant_history",
    about: "self",
    mode: "event",
  },
  family_illness: {
    key: "family_illness",
    label: "Physical health",
    eventType: "illness_injury",
    about: "significant_other",
    mode: "condition",
  },
  family_substance_use: {
    key: "family_substance_use",
    label: "Substance use",
    eventType: "substance_use",
    about: "significant_other",
    mode: "condition",
  },
  family_emotional_problems: {
    key: "family_emotional_problems",
    label: "Mental health",
    eventType: "emotional_problems",
    about: "significant_other",
    mode: "condition",
  },
  family_self_harm: {
    key: "family_self_harm",
    label: "Self-harm",
    eventType: "self_harm",
    about: "significant_other",
    mode: "event",
  },
  family_significant_events: {
    key: "family_significant_events",
    label: "Significant events",
    eventType: "significant_history",
    about: "significant_other",
    mode: "event",
  },
}

const SELF_QUESTION: Partial<Record<EventType, HistoryQuestionKey>> = {
  emotional_problems: "emotional_problems",
  self_harm: "self_harm",
  substance_use: "substance_use",
  illness_injury: "illness_injury",
  traumatic_event: "traumatic_events",
}

const FAMILY_QUESTION: Partial<Record<EventType, HistoryQuestionKey>> = {
  emotional_problems: "family_emotional_problems",
  self_harm: "family_self_harm",
  substance_use: "family_substance_use",
  illness_injury: "family_illness",
}

/** About is Self unless the entry says Significant other. */
export function resolvedAbout(event: { about?: string }): "self" | "significant_other" {
  return event.about === "significant_other" ? "significant_other" : "self"
}

/** Worth-checking text. Family group keeps its prefix so Mental health rows stay distinct. */
export function historyQuestionCheckLabel(key: HistoryQuestionKey): string {
  const label = HISTORY_QUESTIONS[key].label
  return key.startsWith("family_") ? `Significant other history: ${label}` : label
}

/**
 * Every history entry belongs to exactly one screening question.
 * Treatments belong under an issue — they are not a screening category.
 * Unlinked treatments (should not exist) fall through to significant events.
 */
export function historyQuestionKeyForEvent(
  event: Pick<EventRecord, "eventType" | "startPrecision" | "startValue" | "conditionGroupId" | "parentEventId"> & {
    about?: string
  },
  _dateOfBirth: string | null
): HistoryQuestionKey {
  const about = resolvedAbout(event)
  if (event.parentEventId) {
    return about === "self" ? "other_significant_events" : "family_significant_events"
  }
  const type = event.eventType === "family_events" ? "emotional_problems" : event.eventType
  if (type === "psychiatric_admission" || type === "previous_therapy" || type === "medication") {
    // Linked treatments are covered by the issue's Treatment question, not a category.
    // Unlinked treatments are not offered as a screening item any more.
    return about === "self" ? "other_significant_events" : "family_significant_events"
  }
  const table = about === "self" ? SELF_QUESTION : FAMILY_QUESTION
  return table[type] ?? (about === "self" ? "other_significant_events" : "family_significant_events")
}

export function historyQuestionAcceptsEntries(key: HistoryQuestionKey): boolean {
  return HISTORY_QUESTIONS[key].eventType != null
}

export function eventsForQuestion(
  events: EventRecord[],
  key: HistoryQuestionKey,
  dateOfBirth: string | null
): EventRecord[] {
  return events.filter((event) => {
    if (event.parentEventId) return false
    if (
      event.eventType === "psychiatric_admission" ||
      event.eventType === "previous_therapy" ||
      event.eventType === "medication"
    ) {
      return false
    }
    return historyQuestionKeyForEvent(event, dateOfBirth) === key
  })
}

export function sanitizeScreening(value: unknown): ScreeningAnswers {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const screening: ScreeningAnswers = {}
  for (const key of SCREENING_QUESTION_KEYS) {
    const answer = raw[key]
    if (answer === "yes" || answer === "no" || answer === "not_asked") screening[key] = answer
  }
  return screening
}

/**
 * Category questions + each issue's Treatment question + stressors.
 * Treatment questions are dynamic (one per issue).
 * Stressors remain in totals used outside the interview Complete flow.
 */
export function interviewAnswerTotal(issueCount: number): number {
  return HISTORY_QUESTION_KEYS.length + issueCount + STRESSOR_ITEMS.length
}

/** @deprecated Prefer interviewAnswerTotal(issueCount). Base total with no issues. */
export const INTERVIEW_ANSWER_TOTAL = interviewAnswerTotal(0)

export type BackgroundInterviewAnswerSource = {
  status: "in_progress" | "completed"
  dateLabel: string
  screening: ScreeningAnswers
}

export function backgroundInterviewSourceLine(source: BackgroundInterviewAnswerSource | null): string {
  if (!source) return "No background interview yet."
  const state = source.status === "in_progress" ? "in progress" : "completed"
  return `Yes / No / Not asked answers are from the background interview of ${source.dateLabel} (${state}). Change them in the interview.`
}

function answeredCategoryKeys(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "startPrecision" | "startValue" | "conditionGroupId" | "parentEventId" | "about">[],
  dateOfBirth: string | null
): Set<HistoryQuestionKey> {
  const withEntries = new Set<HistoryQuestionKey>()
  for (const event of events) {
    if (event.parentEventId) continue
    if (
      event.eventType === "psychiatric_admission" ||
      event.eventType === "previous_therapy" ||
      event.eventType === "medication"
    ) {
      // Treatments are under issues — not a screening category.
      continue
    }
    withEntries.add(historyQuestionKeyForEvent(event, dateOfBirth))
  }
  return withEntries
}

export function screeningAnsweredCount(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "startPrecision" | "startValue" | "conditionGroupId" | "parentEventId" | "about">[],
  dateOfBirth: string | null
): number {
  const withEntries = answeredCategoryKeys(screening, events, dateOfBirth)
  return SCREENING_QUESTION_KEYS.filter((key) => screening[key] != null || withEntries.has(key)).length
}

export function finalScreeningAnswers(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "startPrecision" | "startValue" | "conditionGroupId" | "parentEventId" | "about">[],
  dateOfBirth: string | null
): Record<ScreeningQuestionKey, ScreeningAnswer> {
  const withEntries = answeredCategoryKeys(screening, events, dateOfBirth)
  const final = {} as Record<ScreeningQuestionKey, ScreeningAnswer>
  for (const key of SCREENING_QUESTION_KEYS) {
    if (withEntries.has(key)) final[key] = "yes"
    else final[key] = screening[key] ?? "not_asked"
  }
  return final
}

export function unansweredQuestionLabels(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "startPrecision" | "startValue" | "conditionGroupId" | "parentEventId" | "about">[],
  dateOfBirth: string | null,
  issues: HistoryIssue[] = []
): string[] {
  const withEntries = answeredCategoryKeys(screening, events, dateOfBirth)
  const labels = HISTORY_QUESTION_KEYS.filter((key) => !withEntries.has(key) && screening[key] == null).map(
    (key) => HISTORY_QUESTIONS[key].label
  )
  for (const issue of issues) {
    if (!issue.treatmentAnswer) {
      const title = issue.title.trim() || "Issue"
      labels.push(`Treatment (${title})`)
    }
  }
  return labels
}

/** Unanswered items: History categories, treatment answers, then Stressors (Client Background). */
export function unansweredInterviewLabels(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "startPrecision" | "startValue" | "conditionGroupId" | "parentEventId" | "about">[],
  dateOfBirth: string | null,
  stressors: StressorsRecord,
  issues: HistoryIssue[] = []
): string[] {
  const labels: string[] = unansweredQuestionLabels(screening, events, dateOfBirth, issues)
  for (const item of STRESSOR_ITEMS) {
    if (stressors[item.key] == null) labels.push(item.label)
  }
  return labels
}

/** Answered items, counted the same way {@link unansweredInterviewLabels} leaves gaps. */
export function answeredInterviewCount(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "startPrecision" | "startValue" | "conditionGroupId" | "parentEventId" | "about">[],
  dateOfBirth: string | null,
  stressors: StressorsRecord,
  issues: HistoryIssue[] = []
): number {
  return interviewAnswerTotal(issues.length) - unansweredInterviewLabels(screening, events, dateOfBirth, stressors, issues).length
}

export function treatmentAnswerLabel(answer: TreatmentAnswer | ""): string {
  if (answer === "yes") return "Yes"
  if (answer === "none") return "None"
  if (answer === "not_asked") return "Not asked"
  return ""
}
