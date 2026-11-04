import {
  STRESSOR_ITEMS,
  type EventRecord,
  type EventType,
  type MedicationRecord,
  type ReasonForAttending,
  type StressorsRecord,
} from "@/lib/client-background/types"

export const HISTORY_QUESTION_GROUPS = [
  {
    title: "Client history",
    keys: [
      "illness_injury",
      "traumatic_events",
      "emotional_problems",
      "substance_use",
      "self_harm",
      "psychiatric_admission",
      "previous_therapy",
      "medication_history",
      "other_significant_events",
    ],
  },
  {
    title: "Significant others",
    keys: [
      "family_illness",
      "family_emotional_problems",
      "family_substance_use",
      "family_self_harm",
      "family_psychiatric_admission",
      "family_significant_events",
    ],
  },
] as const

export const HISTORY_QUESTION_KEYS = HISTORY_QUESTION_GROUPS.flatMap((group) => group.keys)

export type HistoryQuestionKey = (typeof HISTORY_QUESTION_KEYS)[number]

/** Screening answers, including Medication. */
export type ScreeningQuestionKey = HistoryQuestionKey

export const SCREENING_ANSWERS = ["yes", "no", "not_asked"] as const
export type ScreeningAnswer = (typeof SCREENING_ANSWERS)[number]
export type ScreeningAnswers = Partial<Record<ScreeningQuestionKey, ScreeningAnswer>>

export type HistoryQuestionGroup = (typeof HISTORY_QUESTION_GROUPS)[number]

type QuestionDefinition = {
  key: HistoryQuestionKey
  label: string
  eventType: EventType | null
  attribution: "self" | "family" | null
  about: "self" | "significant_other"
}

const SCREENING_QUESTION_KEYS = HISTORY_QUESTION_KEYS

export const HISTORY_QUESTIONS: Record<HistoryQuestionKey, QuestionDefinition> = {
  emotional_problems: {
    key: "emotional_problems",
    label: "Emotional problems",
    eventType: "emotional_problems",
    attribution: "self",
    about: "self",
  },
  self_harm: {
    key: "self_harm",
    label: "Self-harm",
    eventType: "self_harm",
    attribution: "self",
    about: "self",
  },
  substance_use: {
    key: "substance_use",
    label: "Substance use",
    eventType: "substance_use",
    attribution: "self",
    about: "self",
  },
  psychiatric_admission: {
    key: "psychiatric_admission",
    label: "Hospital admission",
    eventType: "psychiatric_admission",
    attribution: "self",
    about: "self",
  },
  previous_therapy: {
    key: "previous_therapy",
    label: "Previous therapy",
    eventType: "previous_therapy",
    attribution: "self",
    about: "self",
  },
  illness_injury: {
    key: "illness_injury",
    label: "Illness / injury",
    eventType: "illness_injury",
    attribution: "self",
    about: "self",
  },
  traumatic_events: {
    key: "traumatic_events",
    label: "Traumatic events",
    eventType: "traumatic_event",
    attribution: "self",
    about: "self",
  },
  medication_history: {
    key: "medication_history",
    label: "Medication",
    eventType: "medication",
    attribution: "self",
    about: "self",
  },
  other_significant_events: {
    key: "other_significant_events",
    label: "Other significant events",
    eventType: "significant_history",
    attribution: "self",
    about: "self",
  },
  family_emotional_problems: {
    key: "family_emotional_problems",
    label: "Emotional problems",
    eventType: "emotional_problems",
    attribution: "family",
    about: "significant_other",
  },
  family_self_harm: {
    key: "family_self_harm",
    label: "Self-harm",
    eventType: "self_harm",
    attribution: "family",
    about: "significant_other",
  },
  family_substance_use: {
    key: "family_substance_use",
    label: "Substance use",
    eventType: "substance_use",
    attribution: "family",
    about: "significant_other",
  },
  family_psychiatric_admission: {
    key: "family_psychiatric_admission",
    label: "Hospital admission",
    eventType: "psychiatric_admission",
    attribution: "family",
    about: "significant_other",
  },
  family_illness: {
    key: "family_illness",
    label: "Illness / injury",
    eventType: "illness_injury",
    attribution: "family",
    about: "significant_other",
  },
  family_significant_events: {
    key: "family_significant_events",
    label: "Significant events",
    eventType: "significant_history",
    attribution: "family",
    about: "significant_other",
  },
}

const SELF_QUESTION: Partial<Record<EventType, HistoryQuestionKey>> = {
  emotional_problems: "emotional_problems",
  self_harm: "self_harm",
  substance_use: "substance_use",
  psychiatric_admission: "psychiatric_admission",
  previous_therapy: "previous_therapy",
  medication: "medication_history",
  illness_injury: "illness_injury",
  traumatic_event: "traumatic_events",
}

const FAMILY_QUESTION: Partial<Record<EventType, HistoryQuestionKey>> = {
  emotional_problems: "family_emotional_problems",
  self_harm: "family_self_harm",
  substance_use: "family_substance_use",
  psychiatric_admission: "family_psychiatric_admission",
  illness_injury: "family_illness",
}

/**
 * Legacy rows stored a family member on attribution. An explicit significant-other
 * About wins when attribution is still self.
 */
export function resolvedAbout(event: { attribution?: string; about?: string }): "self" | "significant_other" {
  if (event.attribution && event.attribution !== "self") return "significant_other"
  if (event.about === "significant_other") return "significant_other"
  return "self"
}

/** Worth-checking text. Significant others keeps its group name so the two Hospital admission rows stay distinct. */
export function historyQuestionCheckLabel(key: HistoryQuestionKey): string {
  const label = HISTORY_QUESTIONS[key].label
  return key.startsWith("family_") ? `Significant others: ${label}` : label
}

/**
 * Every history entry belongs to exactly one screening question.
 * About = Self uses the client headings. About = Significant other uses the
 * significant-others headings. The old family_events rows are emotional problems.
 * A significant-other type with no heading of its own lands on Significant events.
 */
export function historyQuestionKeyForEvent(
  event: Pick<EventRecord, "eventType" | "attribution" | "startPrecision" | "startValue"> & {
    about?: string
  },
  _dateOfBirth: string | null
): HistoryQuestionKey {
  const about = resolvedAbout(event)
  const type = event.eventType === "family_events" ? "emotional_problems" : event.eventType
  const table = about === "self" ? SELF_QUESTION : FAMILY_QUESTION
  return table[type] ?? (about === "self" ? "other_significant_events" : "family_significant_events")
}

export function historyQuestionAcceptsEntries(key: HistoryQuestionKey): key is ScreeningQuestionKey {
  return HISTORY_QUESTIONS[key].eventType != null
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
  for (const key of SCREENING_QUESTION_KEYS) {
    const answer = raw[key]
    if (answer === "yes" || answer === "no" || answer === "not_asked") screening[key] = answer
  }
  return screening
}

/** The three counted Reason for attending questions. Client's motivation is optional and is not one of them. */
const REASON_ANSWER_FIELDS = [
  ["referredByMedicalProfessional", "Referred by a medical professional"],
  ["familyInvolved", "Family involved in them attending"],
  ["ownInitiative", "Came on their own initiative"],
] as const satisfies readonly (readonly [keyof ReasonForAttending, string])[]

/**
 * Reason for attending (3), client and family history (15, including Medication),
 * and the nine stressors.
 */
export const INTERVIEW_ANSWER_TOTAL =
  REASON_ANSWER_FIELDS.length + HISTORY_QUESTION_KEYS.length + STRESSOR_ITEMS.length

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
  return SCREENING_QUESTION_KEYS.filter((key) => screening[key] != null || withEntries.has(key)).length
}

export function finalScreeningAnswers(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "attribution" | "startPrecision" | "startValue">[],
  dateOfBirth: string | null
): Record<ScreeningQuestionKey, ScreeningAnswer> {
  const withEntries = new Set(events.map((event) => historyQuestionKeyForEvent(event, dateOfBirth)))
  const final = {} as Record<ScreeningQuestionKey, ScreeningAnswer>
  for (const key of SCREENING_QUESTION_KEYS) {
    if (withEntries.has(key)) final[key] = "yes"
    else final[key] = screening[key] ?? "not_asked"
  }
  return final
}

export function unansweredQuestionLabels(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "attribution" | "startPrecision" | "startValue">[],
  dateOfBirth: string | null,
  _medication: MedicationRecord
): string[] {
  const withEntries = new Set(events.map((event) => historyQuestionKeyForEvent(event, dateOfBirth)))
  return HISTORY_QUESTION_KEYS.filter((key) => !withEntries.has(key) && screening[key] == null).map(
    (key) => HISTORY_QUESTIONS[key].label
  )
}

function unansweredReasonLabels(reason: ReasonForAttending): string[] {
  return REASON_ANSWER_FIELDS.filter(([key]) => reason[key] == null).map(([, label]) => label)
}

/** Unanswered items in page order: Reason for attending, then the rest of Background, then History, then Stressors. */
export function unansweredInterviewLabels(
  screening: ScreeningAnswers,
  events: Pick<EventRecord, "eventType" | "attribution" | "startPrecision" | "startValue">[],
  dateOfBirth: string | null,
  medication: MedicationRecord,
  stressors: StressorsRecord,
  reason: ReasonForAttending
): string[] {
  const labels: string[] = unansweredReasonLabels(reason)
  labels.push(...unansweredQuestionLabels(screening, events, dateOfBirth, medication))
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
  stressors: StressorsRecord,
  reason: ReasonForAttending
): number {
  return (
    INTERVIEW_ANSWER_TOTAL -
    unansweredInterviewLabels(screening, events, dateOfBirth, medication, stressors, reason).length
  )
}
