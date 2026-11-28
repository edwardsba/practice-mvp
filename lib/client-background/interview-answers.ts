/**
 * Background interview answers_json — per-item Yes/No/N/A (and variants)
 * belonging to one interview date. Clinical facts stay on living tables;
 * this JSON records what was checked on the interview.
 */

import { itemStatus, type SectionStatus, type StatusItem } from "@/lib/section-status"
import type { HistoryQuestionKey } from "@/lib/client-background/interview-history"
import {
  HISTORY_QUESTION_GROUPS,
  HISTORY_QUESTIONS,
} from "@/lib/client-background/interview-history"
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

/** Per-section sign-off in answers_json (Round AQ). Keys are "1"…"9". */
export type InterviewSectionConfirm = {
  confirmed: true
  confirmedAt: string
}

/** Self-report Use client's / Keep decisions (Round AR). */
export type InterviewClientDecision = {
  choice: "used" | "kept"
  at: string
}

export type InterviewAnswersJson = {
  version: 1
  items: Record<string, InterviewItemAnswer>
  /** Section confirmations — missing key means not confirmed. */
  sections: Record<string, InterviewSectionConfirm>
  /** Per fine-grained self-report field key (e.g. identity.pronouns). */
  clientDecisions: Record<string, InterviewClientDecision>
}

/** Yes/No/N/A and Yes/N/A items keep their own answer buttons. */
export function isQuestionKind(kind: InterviewAnswerKind): boolean {
  return kind === "yna" || kind === "ya"
}

/** Confirmed/Not applicable (and per-record) items — signed off by Confirm section. */
export function isDetailsKind(kind: InterviewAnswerKind): boolean {
  return kind === "cna"
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

function numberedHistoryItems(
  prefix: "s8" | "s9",
  keys: readonly HistoryQuestionKey[]
): InterviewItemDef[] {
  return keys.map((key, index) => ({
    key: `${prefix}_${key}`,
    label: `${index + 1}. ${HISTORY_QUESTIONS[key].label}`,
    kind: "yna" as const,
  }))
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
      { key: "s1_preferred_name", label: "Preferred name", kind: "cna" },
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
      { key: "s7_who", label: "Who lives in the home", kind: "cna" },
      { key: "s7_housing_type", label: "Housing type", kind: "cna" },
      { key: "s7_housing_security", label: "Housing security", kind: "cna" },
    ],
  },
  {
    number: 8,
    id: "client-history",
    title: "Client history",
    nothingToRecord: true,
    items: numberedHistoryItems("s8", CLIENT_HISTORY_KEYS),
  },
  {
    number: 9,
    id: "significant-other-history",
    title: HISTORY_QUESTION_GROUPS[1].title,
    nothingToRecord: true,
    items: numberedHistoryItems("s9", FAMILY_HISTORY_KEYS),
  },
]

export const ALL_INTERVIEW_ITEM_KEYS = INTERVIEW_SECTIONS.flatMap((section) =>
  section.items.map((item) => item.key)
)

const ITEM_BY_KEY = new Map(
  INTERVIEW_SECTIONS.flatMap((section) => section.items.map((item) => [item.key, item] as const))
)

export const S4_EC_PREFIX = "s4_ec:"
export const S4_MC_PREFIX = "s4_mc:"

export function isPerRecordContactKey(key: string): boolean {
  return key.startsWith(S4_EC_PREFIX) || key.startsWith(S4_MC_PREFIX)
}

export function perRecordContactId(key: string): string | null {
  if (key.startsWith(S4_EC_PREFIX)) return key.slice(S4_EC_PREFIX.length) || null
  if (key.startsWith(S4_MC_PREFIX)) return key.slice(S4_MC_PREFIX.length) || null
  return null
}

export function kindForInterviewItemKey(key: string): InterviewAnswerKind | null {
  const def = ITEM_BY_KEY.get(key)
  if (def) return def.kind
  if (isPerRecordContactKey(key) && perRecordContactId(key)) return "cna"
  return null
}

export function interviewItemDef(key: string): InterviewItemDef | undefined {
  const staticDef = ITEM_BY_KEY.get(key)
  if (staticDef) return staticDef
  if (isPerRecordContactKey(key) && perRecordContactId(key)) {
    return { key, label: key, kind: "cna" }
  }
  return undefined
}

export function emptyInterviewAnswers(): InterviewAnswersJson {
  return { version: 1, items: {}, sections: {}, clientDecisions: {} }
}

function sectionKey(sectionNumber: number): string {
  return String(sectionNumber)
}

export function isSectionConfirmed(
  answers: InterviewAnswersJson,
  sectionNumber: number
): boolean {
  return answers.sections[sectionKey(sectionNumber)]?.confirmed === true
}

export function questionItemsInSection(
  section: InterviewSectionDef,
  extraItems: readonly InterviewItemDef[] = []
): InterviewItemDef[] {
  return [...section.items, ...extraItems].filter((item) => isQuestionKind(item.kind))
}

export function detailsItemsInSection(
  section: InterviewSectionDef,
  extraItems: readonly InterviewItemDef[] = []
): InterviewItemDef[] {
  return [...section.items, ...extraItems].filter((item) => isDetailsKind(item.kind))
}

/** "Answer 1 question first" / "Answer N questions first" (Confirm section helper). */
export function answerQuestionsFirstLabel(unanswered: number): string {
  return unanswered === 1 ? "Answer 1 question first" : `Answer ${unanswered} questions first`
}

/** Count of question items in the section that still have no answer. */
export function unansweredQuestionCount(
  section: InterviewSectionDef,
  answers: InterviewAnswersJson,
  extraItems: readonly InterviewItemDef[] = []
): number {
  return questionItemsInSection(section, extraItems).filter((item) => !answers.items[item.key])
    .length
}

/**
 * Confirm a section: refuse if any question is unanswered; set each details item
 * to confirmed (has data) or not_applicable (empty); mark every item confirmed;
 * set sections[n].
 */
export function confirmSectionAnswers(
  answers: InterviewAnswersJson,
  sectionNumber: number,
  detailHasValue: Readonly<Record<string, boolean>>,
  extraItems: readonly InterviewItemDef[] = [],
  confirmedAt: string = new Date().toISOString()
):
  | { ok: true; answers: InterviewAnswersJson }
  | { ok: false; error: string; unanswered: number } {
  const section = INTERVIEW_SECTIONS.find((item) => item.number === sectionNumber)
  if (!section) return { ok: false, error: "Unknown interview section.", unanswered: 0 }
  const unanswered = unansweredQuestionCount(section, answers, extraItems)
  if (unanswered > 0) {
    return { ok: false, error: answerQuestionsFirstLabel(unanswered), unanswered }
  }
  const items = { ...answers.items }
  for (const item of [...section.items, ...extraItems]) {
    if (isDetailsKind(item.kind)) {
      const hasValue = detailHasValue[item.key] === true
      items[item.key] = {
        value: hasValue ? "confirmed" : "not_applicable",
        confirmed: true,
      }
      continue
    }
    const existing = items[item.key]
    if (existing) {
      items[item.key] = { value: existing.value, confirmed: true }
    }
  }
  return {
    ok: true,
    answers: {
      version: 1,
      items,
      sections: {
        ...answers.sections,
        [sectionKey(sectionNumber)]: { confirmed: true, confirmedAt },
      },
      clientDecisions: answers.clientDecisions,
    },
  }
}

/**
 * Validate an item key + value for save.
 * Unknown keys and values that don't suit the item's kind are refused.
 * Per-record keys `s4_ec:<id>` / `s4_mc:<id>` take Confirmed or Not applicable.
 */
export function validateItemAnswer(
  itemKey: string,
  value: unknown
): { ok: true; value: InterviewAnswerValue } | { ok: false; error: string } {
  const kind = kindForInterviewItemKey(itemKey)
  if (!kind) return { ok: false, error: "Unknown interview item." }
  if (!isValueAllowedForKind(kind, value)) {
    return { ok: false, error: "That answer is not allowed for this item." }
  }
  return { ok: true, value }
}

function readAnswerEntry(
  entry: unknown,
  kind: InterviewAnswerKind
): InterviewItemAnswer | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null
  const row = entry as Record<string, unknown>
  if (!isValueAllowedForKind(kind, row.value)) return null
  return { value: row.value, confirmed: row.confirmed === true }
}

function readSectionConfirm(entry: unknown): InterviewSectionConfirm | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null
  const row = entry as Record<string, unknown>
  if (row.confirmed !== true) return null
  if (typeof row.confirmedAt !== "string" || !row.confirmedAt.trim()) return null
  return { confirmed: true, confirmedAt: row.confirmedAt }
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
    const parsed = readAnswerEntry(itemsRaw[key], def.kind)
    if (parsed) items[key] = parsed
  }
  for (const key of Object.keys(itemsRaw)) {
    if (!isPerRecordContactKey(key) || !perRecordContactId(key)) continue
    const parsed = readAnswerEntry(itemsRaw[key], "cna")
    if (parsed) items[key] = parsed
  }
  const sectionsRaw =
    raw.sections && typeof raw.sections === "object" && !Array.isArray(raw.sections)
      ? (raw.sections as Record<string, unknown>)
      : {}
  const sections: Record<string, InterviewSectionConfirm> = {}
  for (const n of INTERVIEW_SECTIONS.map((section) => section.number)) {
    const key = sectionKey(n)
    const parsed = readSectionConfirm(sectionsRaw[key])
    if (parsed) sections[key] = parsed
  }
  const decisionsRaw =
    raw.clientDecisions && typeof raw.clientDecisions === "object" && !Array.isArray(raw.clientDecisions)
      ? (raw.clientDecisions as Record<string, unknown>)
      : {}
  const clientDecisions: Record<string, InterviewClientDecision> = {}
  for (const [key, entry] of Object.entries(decisionsRaw)) {
    if (!key.trim()) continue
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
    const row = entry as Record<string, unknown>
    if (row.choice !== "used" && row.choice !== "kept") continue
    if (typeof row.at !== "string" || !row.at.trim()) continue
    clientDecisions[key] = { choice: row.choice, at: row.at }
  }
  return { version: 1, items, sections, clientDecisions }
}

/**
 * Drop per-record answers whose ids are no longer in the living contact lists.
 * Static keys are unchanged.
 */
export function dropMissingPerRecordAnswers(
  answers: InterviewAnswersJson,
  living: { emergencyContactIds: readonly string[]; medicalContactIds: readonly string[] }
): InterviewAnswersJson {
  const ec = new Set(living.emergencyContactIds)
  const mc = new Set(living.medicalContactIds)
  const items: Record<string, InterviewItemAnswer> = {}
  for (const [key, answer] of Object.entries(answers.items)) {
    if (key.startsWith(S4_EC_PREFIX)) {
      const id = perRecordContactId(key)
      if (!id || !ec.has(id)) continue
    } else if (key.startsWith(S4_MC_PREFIX)) {
      const id = perRecordContactId(key)
      if (!id || !mc.has(id)) continue
    }
    items[key] = answer
  }
  return {
    version: 1,
    items,
    sections: answers.sections,
    clientDecisions: answers.clientDecisions ?? {},
  }
}

/** Copy prior interview item values unconfirmed; do not copy sections or clientDecisions. */
export function prefillAnswersForReview(source: InterviewAnswersJson): InterviewAnswersJson {
  const items: Record<string, InterviewItemAnswer> = {}
  for (const [key, answer] of Object.entries(source.items)) {
    const kind = kindForInterviewItemKey(key)
    if (!kind) continue
    if (!isValueAllowedForKind(kind, answer.value)) continue
    items[key] = { value: answer.value, confirmed: false }
  }
  return { version: 1, items, sections: {}, clientDecisions: {} }
}

export function setClientDecision(
  answers: InterviewAnswersJson,
  fieldKey: string,
  choice: "used" | "kept",
  at: string = new Date().toISOString()
): InterviewAnswersJson {
  if (!fieldKey.trim()) return answers
  return {
    ...answers,
    clientDecisions: {
      ...answers.clientDecisions,
      [fieldKey]: { choice, at },
    },
  }
}

export function statusItemForAnswer(answer: InterviewItemAnswer | undefined): StatusItem {
  if (!answer) return { hasValue: false, confirmed: false }
  return { hasValue: true, confirmed: answer.confirmed }
}

export function interviewItemStatus(answer: InterviewItemAnswer | undefined) {
  return itemStatus(statusItemForAnswer(answer))
}

/**
 * Interview section status (Round AQ / AR):
 * - done when sections[n] is confirmed and every question is answered
 * - not started when nothing answered, nothing pre-filled, not confirmed
 * - otherwise in progress: "N to answer" (left), "N client changes", or "Ready to confirm"
 */
export function interviewSectionStatus(
  section: InterviewSectionDef,
  answers: InterviewAnswersJson,
  extraItems: readonly InterviewItemDef[] = [],
  options?: { waitingClientChanges?: number }
): SectionStatus {
  const allItems = [...section.items, ...extraItems]
  const unanswered = unansweredQuestionCount(section, answers, extraItems)
  const confirmed = isSectionConfirmed(answers, section.number)
  const waitingClientChanges = Math.max(0, options?.waitingClientChanges ?? 0)
  const anyPrefilled = allItems.some((item) => {
    const answer = answers.items[item.key]
    return Boolean(answer && !answer.confirmed)
  })
  const anyQuestionAnswered = questionItemsInSection(section, extraItems).some(
    (item) => Boolean(answers.items[item.key])
  )
  const anyDetailsTouched = detailsItemsInSection(section, extraItems).some((item) =>
    Boolean(answers.items[item.key])
  )

  let status: SectionStatus["status"]
  let left = unanswered
  let toConfirm = 0
  if (confirmed && unanswered === 0) {
    status = "done"
  } else if (
    !anyQuestionAnswered &&
    !anyPrefilled &&
    !anyDetailsTouched &&
    waitingClientChanges === 0 &&
    !confirmed
  ) {
    status = "not_started"
    left = unanswered
  } else if (unanswered > 0) {
    status = "left"
  } else {
    // Questions done (or none); waiting for Confirm section (and maybe client changes).
    status = "to_confirm"
    toConfirm = 0
  }

  return {
    groupLabel: section.id,
    letter: String(section.number),
    title: section.title,
    status,
    left,
    toConfirm,
    clientChanges: waitingClientChanges > 0 && unanswered === 0 ? waitingClientChanges : 0,
    hasDefaults: false,
  }
}

/**
 * Per-record confirm rows under section 4 whenever matching records exist
 * (shown before the parent is answered, so the practitioner can see what's on file).
 */
export function section4ExtraItems(input: {
  answers: InterviewAnswersJson
  emergencyContacts: Array<{ id: string; label: string }>
  gpContacts: Array<{ id: string; label: string }>
  otherMedicalContacts: Array<{ id: string; label: string }>
}): InterviewItemDef[] {
  const extras: InterviewItemDef[] = []
  for (const contact of input.emergencyContacts) {
    extras.push({ key: `${S4_EC_PREFIX}${contact.id}`, label: contact.label, kind: "cna" })
  }
  for (const contact of input.gpContacts) {
    extras.push({ key: `${S4_MC_PREFIX}${contact.id}`, label: contact.label, kind: "cna" })
  }
  for (const contact of input.otherMedicalContacts) {
    extras.push({ key: `${S4_MC_PREFIX}${contact.id}`, label: contact.label, kind: "cna" })
  }
  return extras
}

/**
 * Mark every unanswered question in the section Not applicable (confirmed).
 * Details items are left alone — Confirm section signs those off.
 */
export function applyNothingToRecord(
  answers: InterviewAnswersJson,
  sectionNumber: number
): InterviewAnswersJson {
  const section = INTERVIEW_SECTIONS.find((item) => item.number === sectionNumber)
  if (!section) return answers
  const items = { ...answers.items }
  for (const item of section.items) {
    if (!isQuestionKind(item.kind)) continue
    if (items[item.key]) continue
    if (!isValueAllowedForKind(item.kind, "not_applicable")) continue
    items[item.key] = { value: "not_applicable", confirmed: true }
  }
  return {
    version: 1,
    items,
    sections: answers.sections,
    clientDecisions: answers.clientDecisions ?? {},
  }
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
    sections: answers.sections,
    clientDecisions: answers.clientDecisions ?? {},
  }
}

/** Sections that are not yet confirmed (Complete uses this). */
export function sectionsNotConfirmed(answers: InterviewAnswersJson): number[] {
  return INTERVIEW_SECTIONS.filter((section) => !isSectionConfirmed(answers, section.number)).map(
    (section) => section.number
  )
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
