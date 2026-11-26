/**
 * Background interview answers_json — per-item Yes/No/N/A (and variants)
 * belonging to one interview date. Clinical facts stay on living tables;
 * this JSON records what was checked on the interview.
 */

import {
  aggregateSectionStatus,
  itemStatus,
  type SectionStatus,
  type StatusItem,
} from "@/lib/section-status"
import type { HistoryQuestionKey } from "@/lib/client-background/interview-history"
import { HISTORY_QUESTION_GROUPS } from "@/lib/client-background/interview-history"
import type { BlockAnswer, RelationshipBlockAnswers } from "@/lib/client-background/types"
import type { ScreeningAnswer, ScreeningAnswers } from "@/lib/client-background/interview-history"

export const INTERVIEW_ANSWER_VALUES = [
  "yes",
  "no",
  "not_applicable",
  "confirmed",
  "lives_with_others",
  "lives_alone",
] as const
export type InterviewAnswerValue = (typeof INTERVIEW_ANSWER_VALUES)[number]

export type InterviewItemAnswer = {
  value: InterviewAnswerValue
  confirmed: boolean
}

export type InterviewAnswersJson = {
  version: 1
  items: Record<string, InterviewItemAnswer>
}

export type InterviewAnswerKind = "yna" | "cna" | "ya" | "living"

export type InterviewSectionDef = {
  number: number
  id: string
  title: string
  /** Sections that show "Nothing to record". */
  nothingToRecord: boolean
  items: InterviewItemDef[]
}

export type InterviewItemDef = {
  key: string
  label: string
  kind: InterviewAnswerKind
}

const CLIENT_HISTORY_KEYS = HISTORY_QUESTION_GROUPS[0].keys
const FAMILY_HISTORY_KEYS = HISTORY_QUESTION_GROUPS[1].keys

const HISTORY_LABELS: Record<string, string> = {
  emotional_problems: "Mental health",
  substance_use: "Substance use",
  illness_injury: "Physical health",
  self_harm: "Self-harm",
  traumatic_events: "Traumatic events",
  other_significant_events: "Other significant events",
  other_treatment: "Other treatment not linked to an issue",
  family_emotional_problems: "Mental health",
  family_substance_use: "Substance use",
  family_illness: "Physical health",
  family_self_harm: "Self-harm",
  family_significant_events: "Significant events",
}

/** Allowed answer values for each item kind — single source of truth for save + sanitize. */
export function allowedValuesForKind(kind: InterviewAnswerKind): readonly InterviewAnswerValue[] {
  if (kind === "yna") return ["yes", "no", "not_applicable"]
  if (kind === "cna") return ["confirmed", "not_applicable"]
  if (kind === "ya") return ["yes", "not_applicable"]
  return ["lives_with_others", "lives_alone"]
}

export function isValueAllowedForKind(
  kind: InterviewAnswerKind,
  value: unknown
): value is InterviewAnswerValue {
  return (allowedValuesForKind(kind) as readonly string[]).includes(value as string)
}

export const INTERVIEW_SECTIONS: InterviewSectionDef[] = [
  {
    number: 1,
    id: "contact",
    title: "Contact details",
    nothingToRecord: false,
    items: [
      { key: "s1_name", label: "Name", kind: "cna" },
      { key: "s1_dob", label: "Date of birth", kind: "cna" },
      { key: "s1_phone", label: "Phone", kind: "cna" },
      { key: "s1_email", label: "Email", kind: "cna" },
      { key: "s1_address", label: "Address", kind: "cna" },
      { key: "s1_comms", label: "Communication preferences", kind: "cna" },
    ],
  },
  {
    number: 2,
    id: "funding",
    title: "Funding details",
    nothingToRecord: false,
    items: [
      { key: "s2_medicare", label: "Medicare", kind: "ya" },
      { key: "s2_ndis", label: "NDIS", kind: "yna" },
      { key: "s2_insurance", label: "Insurance or WorkCover", kind: "yna" },
    ],
  },
  {
    number: 3,
    id: "demographics",
    title: "Demographics",
    nothingToRecord: false,
    items: [
      { key: "s3_identity", label: "Identity", kind: "cna" },
      { key: "s3_disability", label: "Disability or access needs", kind: "yna" },
      { key: "s3_education", label: "Education", kind: "cna" },
      { key: "s3_occupation", label: "Occupation", kind: "cna" },
      { key: "s3_financial", label: "Financial hardship", kind: "yna" },
    ],
  },
  {
    number: 4,
    id: "contacts",
    title: "Emergency contacts and treating professionals",
    nothingToRecord: true,
    items: [
      { key: "s4_emergency", label: "Emergency contact", kind: "ya" },
      { key: "s4_gp", label: "GP", kind: "yna" },
      { key: "s4_other_professionals", label: "Other treating professionals", kind: "yna" },
    ],
  },
  {
    number: 5,
    id: "intimate",
    title: "Intimate relationships and children",
    nothingToRecord: true,
    items: [
      { key: "s5_current", label: "Current relationship", kind: "yna" },
      { key: "s5_previous", label: "Previous relationships", kind: "yna" },
      { key: "s5_children", label: "Children", kind: "yna" },
    ],
  },
  {
    number: 6,
    id: "caregivers",
    title: "Primary caregivers and siblings",
    nothingToRecord: true,
    items: [
      { key: "s6_biological_parents", label: "Biological parents", kind: "cna" },
      { key: "s6_mother_other", label: "Mother's other relationships", kind: "yna" },
      { key: "s6_father_other", label: "Father's other relationships", kind: "yna" },
      { key: "s6_caregiver", label: "Other caregiver arrangements", kind: "yna" },
      { key: "s6_siblings", label: "Siblings", kind: "yna" },
    ],
  },
  {
    number: 7,
    id: "living",
    title: "Living situation",
    nothingToRecord: false,
    items: [
      { key: "s7_who", label: "Who lives in the home", kind: "living" },
      { key: "s7_housing_type", label: "Housing type", kind: "cna" },
      { key: "s7_housing_security", label: "Housing security", kind: "cna" },
    ],
  },
  {
    number: 8,
    id: "client-history",
    title: "Client history",
    nothingToRecord: true,
    items: CLIENT_HISTORY_KEYS.map((key) => ({
      key: `s8_${key}`,
      label: HISTORY_LABELS[key] ?? key,
      kind: "yna" as const,
    })),
  },
  {
    number: 9,
    id: "significant-other-history",
    title: "Significant other history",
    nothingToRecord: true,
    items: FAMILY_HISTORY_KEYS.map((key) => ({
      key: `s9_${key}`,
      label: HISTORY_LABELS[key] ?? key,
      kind: "yna" as const,
    })),
  },
]

export const ALL_INTERVIEW_ITEM_KEYS = INTERVIEW_SECTIONS.flatMap((section) =>
  section.items.map((item) => item.key)
)

const ITEM_BY_KEY = new Map(
  INTERVIEW_SECTIONS.flatMap((section) => section.items.map((item) => [item.key, item] as const))
)

export function interviewItemDef(key: string): InterviewItemDef | undefined {
  return ITEM_BY_KEY.get(key)
}

export function emptyInterviewAnswers(): InterviewAnswersJson {
  return { version: 1, items: {} }
}

/**
 * Validate an item key + value for save.
 * Unknown keys and values that don't suit the item's kind are refused.
 */
export function validateItemAnswer(
  itemKey: string,
  value: unknown
): { ok: true; value: InterviewAnswerValue } | { ok: false; error: string } {
  const def = ITEM_BY_KEY.get(itemKey)
  if (!def) return { ok: false, error: "Unknown interview item." }
  if (!isValueAllowedForKind(def.kind, value)) {
    return { ok: false, error: "That answer is not allowed for this item." }
  }
  return { ok: true, value }
}

export function sanitizeInterviewAnswers(value: unknown): InterviewAnswersJson {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const itemsRaw =
    raw.items && typeof raw.items === "object" && !Array.isArray(raw.items)
      ? (raw.items as Record<string, unknown>)
      : {}
  const items: Record<string, InterviewItemAnswer> = {}
  for (const key of ALL_INTERVIEW_ITEM_KEYS) {
    const def = ITEM_BY_KEY.get(key)
    if (!def) continue
    const entry = itemsRaw[key]
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
    const row = entry as Record<string, unknown>
    if (!isValueAllowedForKind(def.kind, row.value)) continue
    items[key] = { value: row.value, confirmed: row.confirmed === true }
  }
  return { version: 1, items }
}

/** Copy prior interview answers with every item marked to confirm. */
export function prefillAnswersForReview(source: InterviewAnswersJson): InterviewAnswersJson {
  const items: Record<string, InterviewItemAnswer> = {}
  for (const [key, answer] of Object.entries(source.items)) {
    const def = ITEM_BY_KEY.get(key)
    if (!def) continue
    if (!isValueAllowedForKind(def.kind, answer.value)) continue
    items[key] = { value: answer.value, confirmed: false }
  }
  return { version: 1, items }
}

export function statusItemForAnswer(answer: InterviewItemAnswer | undefined): StatusItem {
  if (!answer) return { hasValue: false, confirmed: false }
  return { hasValue: true, confirmed: answer.confirmed }
}

export function interviewItemStatus(answer: InterviewItemAnswer | undefined) {
  return itemStatus(statusItemForAnswer(answer))
}

export function interviewSectionStatus(
  section: InterviewSectionDef,
  answers: InterviewAnswersJson
): SectionStatus {
  const items = section.items.map((item) => statusItemForAnswer(answers.items[item.key]))
  const agg = aggregateSectionStatus(items)
  return {
    groupLabel: section.id,
    letter: String(section.number),
    title: section.title,
    status: agg.status,
    left: agg.left,
    toConfirm: agg.toConfirm,
    hasDefaults: false,
  }
}

/** Mark every unanswered item in the section Not applicable (confirmed). Leaves existing answers alone. */
export function applyNothingToRecord(
  answers: InterviewAnswersJson,
  sectionNumber: number
): InterviewAnswersJson {
  const section = INTERVIEW_SECTIONS.find((item) => item.number === sectionNumber)
  if (!section) return answers
  const items = { ...answers.items }
  for (const item of section.items) {
    if (items[item.key]) continue
    if (!isValueAllowedForKind(item.kind, "not_applicable")) continue
    items[item.key] = { value: "not_applicable", confirmed: true }
  }
  return { version: 1, items }
}

export function setItemAnswer(
  answers: InterviewAnswersJson,
  key: string,
  value: InterviewAnswerValue
): InterviewAnswersJson {
  const validated = validateItemAnswer(key, value)
  if (!validated.ok) return answers
  return {
    version: 1,
    items: {
      ...answers.items,
      [key]: { value: validated.value, confirmed: true },
    },
  }
}

export function confirmAllAnswers(answers: InterviewAnswersJson): InterviewAnswersJson {
  const items: Record<string, InterviewItemAnswer> = {}
  for (const [key, answer] of Object.entries(answers.items)) {
    items[key] = { value: answer.value, confirmed: true }
  }
  return { version: 1, items }
}

export function sectionsWithLeft(answers: InterviewAnswersJson): number[] {
  return INTERVIEW_SECTIONS.filter((section) => interviewSectionStatus(section, answers).status === "left").map(
    (section) => section.number
  )
}

export function sectionsWithToConfirm(answers: InterviewAnswersJson): number[] {
  return INTERVIEW_SECTIONS.filter(
    (section) => interviewSectionStatus(section, answers).status === "to_confirm"
  ).map((section) => section.number)
}

/** Screening mirror: yes→yes, no→no, not_applicable→no. Missing → not written (finalise uses not_asked). */
export function mirrorScreeningValue(value: InterviewAnswerValue | undefined): ScreeningAnswer | null {
  if (value === "yes") return "yes"
  if (value === "no" || value === "not_applicable") return "no"
  return null
}

export function screeningFromInterviewAnswers(answers: InterviewAnswersJson): ScreeningAnswers {
  const screening: ScreeningAnswers = {}
  for (const key of CLIENT_HISTORY_KEYS) {
    const answer = answers.items[`s8_${key}`]
    if (!answer) continue
    const mirrored = mirrorScreeningValue(answer.value)
    if (mirrored) screening[key] = mirrored
  }
  for (const key of FAMILY_HISTORY_KEYS) {
    const answer = answers.items[`s9_${key}`]
    if (!answer) continue
    const mirrored = mirrorScreeningValue(answer.value)
    if (mirrored) screening[key] = mirrored
  }
  return screening
}

/** Merge interview screening mirrors into existing screening (interview keys win when set). */
export function mergeScreeningMirror(
  existing: ScreeningAnswers,
  answers: InterviewAnswersJson
): ScreeningAnswers {
  return { ...existing, ...screeningFromInterviewAnswers(answers) }
}

/** Block answer mirror: yes→yes, no|not_applicable→none. */
export function mirrorBlockValue(value: InterviewAnswerValue | undefined): BlockAnswer | "" {
  if (value === "yes") return "yes"
  if (value === "no" || value === "not_applicable") return "none"
  return ""
}

export type BlockAnswerMirrorKey = keyof Pick<
  RelationshipBlockAnswers,
  "previousRelationships" | "motherOtherRelationships" | "fatherOtherRelationships" | "caregiverArrangements"
>

/** Keys in answers_json that mirror a top-level block answer column. */
export const BLOCK_ANSWER_MIRRORS: { itemKey: string; blockKey: BlockAnswerMirrorKey }[] = [
  { itemKey: "s5_previous", blockKey: "previousRelationships" },
  { itemKey: "s6_mother_other", blockKey: "motherOtherRelationships" },
  { itemKey: "s6_father_other", blockKey: "fatherOtherRelationships" },
  { itemKey: "s6_caregiver", blockKey: "caregiverArrangements" },
]

export function blockAnswersFromInterview(
  answers: InterviewAnswersJson
): Partial<Record<BlockAnswerMirrorKey, BlockAnswer>> {
  const out: Partial<Record<BlockAnswerMirrorKey, BlockAnswer>> = {}
  for (const { itemKey, blockKey } of BLOCK_ANSWER_MIRRORS) {
    const answer = answers.items[itemKey]
    if (!answer) continue
    const mirrored = mirrorBlockValue(answer.value)
    if (mirrored) out[blockKey] = mirrored
  }
  return out
}

export function optionsForKind(kind: InterviewAnswerKind): { value: InterviewAnswerValue; label: string }[] {
  return allowedValuesForKind(kind).map((value) => ({
    value,
    label:
      value === "yes"
        ? "Yes"
        : value === "no"
          ? "No"
          : value === "not_applicable"
            ? "Not applicable"
            : value === "confirmed"
              ? "Confirmed"
              : value === "lives_with_others"
                ? "Lives with others"
                : "Lives alone",
  }))
}

export function historyScreeningKeyFromItemKey(itemKey: string): HistoryQuestionKey | null {
  if (itemKey.startsWith("s8_")) {
    const key = itemKey.slice(3) as HistoryQuestionKey
    return (CLIENT_HISTORY_KEYS as readonly string[]).includes(key) ? key : null
  }
  if (itemKey.startsWith("s9_")) {
    const key = itemKey.slice(3) as HistoryQuestionKey
    return (FAMILY_HISTORY_KEYS as readonly string[]).includes(key) ? key : null
  }
  return null
}

export function formatSectionList(numbers: number[]): string {
  if (numbers.length === 0) return ""
  if (numbers.length === 1) return `Section ${numbers[0]}`
  if (numbers.length === 2) return `Sections ${numbers[0]} and ${numbers[1]}`
  return `Sections ${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`
}
