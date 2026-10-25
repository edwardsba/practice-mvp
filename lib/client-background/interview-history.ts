import { lifeStageAtStart } from "@/lib/client-background/age"
import { STRESSOR_ITEMS, type EventRecord, type EventType, type MedicationRecord, type StressorsRecord } from "@/lib/client-background/types"

export const HISTORY_QUESTION_KEYS = [
  "emotional_problems",
  "self_harm",
  "substance_use",
  "psychiatric_admission",
  "previous_therapy",
  "illness_injury",
  "childhood_events",
  "other_significant_events",
  "abuse",
  "family_emotional_problems",
  "family_self_harm",
  "family_substance_use",
  "family_psychiatric_admission",
  "family_illness",
  "family_significant_events",
] as const

export type HistoryQuestionKey = (typeof HISTORY_QUESTION_KEYS)[number]

export const SCREENING_ANSWERS = ["yes", "no", "not_asked"] as const
export type ScreeningAnswer = (typeof SCREENING_ANSWERS)[number]
export type ScreeningAnswers = Partial<Record<HistoryQuestionKey, ScreeningAnswer>>

export type HistoryQuestionGroup = {
  title: string
  keys: HistoryQuestionKey[]
}

export const HISTORY_QUESTION_GROUPS: HistoryQuestionGroup[] = [
  {
    title: "Client: mental health",
    keys: ["emotional_problems", "self_harm", "substance_use", "psychiatric_admission", "previous_therapy"],
  },
  {
    title: "Client: life events",
    keys: ["illness_injury", "childhood_events", "other_significant_events", "abuse"],
  },
  {
    title: "Family history",
    keys: [
      "family_emotional_problems",
      "family_self_harm",
      "family_substance_use",
      "family_psychiatric_admission",
      "family_illness",
      "family_significant_events",
    ],
  },
]

type QuestionDefinition = {
  key: HistoryQuestionKey
  label: string
  eventType: EventType
  attribution: "self" | "family"
}

export const HISTORY_QUESTIONS: Record<HistoryQuestionKey, QuestionDefinition> = {
  emotional_problems: {
    key: "emotional_problems",
    label: "Emotional problems",
    eventType: "emotional_problems",
    attribution: "self",
  },
  self_harm: {
    key: "self_harm",
    label: "Self-harm",
    eventType: "self_harm",
    attribution: "self",
  },
  substance_use: {
    key: "substance_use",
    label: "Substance use",
    eventType: "substance_use",
    attribution: "self",
  },
  psychiatric_admission: {
    key: "psychiatric_admission",
    label: "Psychiatric hospital / rehab",
    eventType: "psychiatric_admission",
    attribution: "self",
  },
  previous_therapy: {
    key: "previous_therapy",
    label: "Previous therapy",
    eventType: "previous_therapy",
    attribution: "self",
  },
  illness_injury: {
    key: "illness_injury",
    label: "Illness / injury",
    eventType: "illness_injury",
    attribution: "self",
  },
  childhood_events: {
    key: "childhood_events",
    label: "Childhood events",
    eventType: "significant_history",
    attribution: "self",
  },
  other_significant_events: {
    key: "other_significant_events",
    label: "Other significant events",
    eventType: "significant_history",
    attribution: "self",
  },
  abuse: {
    key: "abuse",
    label: "Abuse",
    eventType: "abuse",
    attribution: "self",
  },
  family_emotional_problems: {
    key: "family_emotional_problems",
    label: "Family emotional problems",
    eventType: "emotional_problems",
    attribution: "family",
  },
  family_self_harm: {
    key: "family_self_harm",
    label: "Family self-harm",
    eventType: "self_harm",
    attribution: "family",
  },
  family_substance_use: {
    key: "family_substance_use",
    label: "Family substance use",
    eventType: "substance_use",
    attribution: "family",
  },
  family_psychiatric_admission: {
    key: "family_psychiatric_admission",
    label: "Family psych hospital / rehab",
    eventType: "psychiatric_admission",
    attribution: "family",
  },
  family_illness: {
    key: "family_illness",
    label: "Family illness",
    eventType: "illness_injury",
    attribution: "family",
  },
  family_significant_events: {
    key: "family_significant_events",
    label: "Family significant events",
    eventType: "significant_history",
    attribution: "family",
  },
}

const SELF_QUESTION: Partial<Record<EventType, HistoryQuestionKey>> = {
  emotional_problems: "emotional_problems",
  self_harm: "self_harm",
  substance_use: "substance_use",
  psychiatric_admission: "psychiatric_admission",
  previous_therapy: "previous_therapy",
  illness_injury: "illness_injury",
  abuse: "abuse",
}

const FAMILY_QUESTION: Partial<Record<EventType, HistoryQuestionKey>> = {
  emotional_problems: "family_emotional_problems",
  self_harm: "family_self_harm",
  substance_use: "family_substance_use",
  psychiatric_admission: "family_psychiatric_admission",
  illness_injury: "family_illness",
}

/**
 * Every history entry belongs to exactly one screening question.
 * Childhood is the same rule as the History category line. An undated start is not childhood.
 * A family-attributed entry that no specific family row claims lands on family significant events.
 */
export function historyQuestionKeyForEvent(
  event: Pick<EventRecord, "eventType" | "attribution" | "startPrecision" | "startValue">,
  dateOfBirth: string | null
): HistoryQuestionKey {
  if (event.attribution === "self") {
    const key = SELF_QUESTION[event.eventType]
    if (key) return key
  }
  if (event.attribution === "family") {
    const key = FAMILY_QUESTION[event.eventType]
    if (key) return key
  }
  if (
    event.eventType === "family_events" ||
    (event.eventType === "significant_history" && event.attribution === "self")
  ) {
    return lifeStageAtStart(dateOfBirth, event.startPrecision, event.startValue) === "childhood"
      ? "childhood_events"
      : "other_significant_events"
  }
  return "family_significant_events"
}

export function eventsForQuestion(
  events: EventRecord[],
  key: HistoryQuestionKey,
  dateOfBirth: string | null
): EventRecord[] {
  return events.filter((event) => historyQuestionKeyForEvent(event, dateOfBirth) === key)
}

export function sanitizeScreening(value: unknown): ScreeningAnswers {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const screening: ScreeningAnswers = {}
  for (const key of HISTORY_QUESTION_KEYS) {
    const answer = raw[key]
    if (answer === "yes" || answer === "no" || answer === "not_asked") screening[key] = answer
  }
  return screening
}

/** History questions, currently taking medication, and the nine stressors. */
export const INTERVIEW_ANSWER_TOTAL = HISTORY_QUESTION_KEYS.length + 1 + STRESSOR_ITEMS.length

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

export function screeningAnsweredCount(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "attribution" | "startPrecision" | "startValue">[],
  dateOfBirth: string | null
): number {
  const withEntries = new Set(events.map((event) => historyQuestionKeyForEvent(event, dateOfBirth)))
  return HISTORY_QUESTION_KEYS.filter((key) => screening[key] != null || withEntries.has(key)).length
}

export function finalScreeningAnswers(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "attribution" | "startPrecision" | "startValue">[],
  dateOfBirth: string | null
): Record<HistoryQuestionKey, ScreeningAnswer> {
  const withEntries = new Set(events.map((event) => historyQuestionKeyForEvent(event, dateOfBirth)))
  const final = {} as Record<HistoryQuestionKey, ScreeningAnswer>
  for (const key of HISTORY_QUESTION_KEYS) {
    if (withEntries.has(key)) final[key] = "yes"
    else final[key] = screening[key] ?? "not_asked"
  }
  return final
}

export function unansweredQuestionLabels(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "attribution" | "startPrecision" | "startValue">[],
  dateOfBirth: string | null
): string[] {
  const withEntries = new Set(events.map((event) => historyQuestionKeyForEvent(event, dateOfBirth)))
  return HISTORY_QUESTION_KEYS.filter((key) => !withEntries.has(key) && screening[key] == null).map(
    (key) => HISTORY_QUESTIONS[key].label
  )
}

/** Screening gaps, plus medication and stressors that are still empty. */
export function unansweredInterviewLabels(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "attribution" | "startPrecision" | "startValue">[],
  dateOfBirth: string | null,
  medication: MedicationRecord,
  stressors: StressorsRecord
): string[] {
  const labels = unansweredQuestionLabels(screening, events, dateOfBirth)
  if (medication.currentlyTaking == null) labels.push("Currently taking medication")
  for (const item of STRESSOR_ITEMS) {
    if (stressors[item.key] == null) labels.push(item.label)
  }
  return labels
}

/** Answered items, counted the same way {@link unansweredInterviewLabels} leaves gaps. */
export function answeredInterviewCount(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "attribution" | "startPrecision" | "startValue">[],
  dateOfBirth: string | null,
  medication: MedicationRecord,
  stressors: StressorsRecord
): number {
  return (
    INTERVIEW_ANSWER_TOTAL -
    unansweredInterviewLabels(screening, events, dateOfBirth, medication, stressors).length
  )
}
