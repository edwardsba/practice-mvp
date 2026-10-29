import { assessAge, clientAgeAtStart, compareEventsChronologically } from "@/lib/client-background/age"
import {
  HISTORY_QUESTION_GROUPS,
  HISTORY_QUESTIONS,
  eventsForQuestion,
  type HistoryQuestionKey,
  type ScreeningAnswers,
} from "@/lib/client-background/interview-history"
import { parsePartialDate, precisionForPartialDate } from "@/lib/client-background/partial-date"
import { canonicalParentsLink, personRoleLabel } from "@/lib/client-background/tree"
import {
  CLIENT_RELATIONSHIP_STATUS_LABELS,
  LIVES_WITH_LABELS,
  NECESSITY_KEYS,
  NECESSITY_LABELS,
  STRESSOR_ITEMS,
  type ClientBackgroundData,
  type ClientRelationshipStatus,
  type EventRecord,
  type RelationshipRecord,
  type RelationshipToClient,
  type StartPrecision,
} from "@/lib/client-background/types"
import type { LetterBodyDoc, LetterBodyNode } from "@/lib/reports/letter-body-types"

export type BackgroundReportOmissionTarget =
  | "reason"
  | "demographics"
  | "relationships"
  | "history"
  | "stressors"
  | "identity"
  | "occupation"
  | "living"
  | "medication"
  | "practitioner"
  | "interview"

export type BackgroundReportOmission = {
  id: string
  message: string
  target: BackgroundReportOmissionTarget
}

export type BackgroundReportReferral = {
  title: string | null
  firstName: string
  lastName: string
  profession: string | null
  /** Partial date, or null when none was recorded. */
  date: string | null
}

export type BackgroundReportInterview = {
  /** YYYY-MM-DD. Completed date, or the interview date when it is not completed. */
  date: string
}

/** One interview row, already dated in practice time, before the report chooses which to use. */
export type ReportInterviewCandidate = {
  status: string
  /** ISO time the interview was started. Used to decide which row is latest. */
  startedAt: string
  /** ISO time it was completed, or null. */
  completedAt: string | null
  /** YYYY-MM-DD shown on the source line. */
  date: string
}

export type ChosenReportInterviews = {
  /** Index of the row whose screening answers the report uses. */
  answerIndex: number | null
  /** One entry per distinct date. Completed interviews, plus the in-progress fallback. */
  dates: string[]
  writtenFromIncomplete: boolean
}

/**
 * Screening answers come from the latest completed interview. An in-progress
 * interview is used only when nothing has been completed, and only that
 * interview is then listed as a source. Completed interviews on the same date
 * produce one source line.
 */
export function chooseReportInterviews(rows: ReportInterviewCandidate[]): ChosenReportInterviews {
  const indexed = rows.map((row, index) => ({ row, index }))
  const completed = indexed.filter((item) => item.row.status === "completed" && item.row.date.trim())
  const inProgress = indexed.filter((item) => item.row.status === "in_progress" && item.row.date.trim())
  const latestKey = (item: { row: ReportInterviewCandidate }) =>
    item.row.completedAt?.trim() || item.row.startedAt.trim()

  if (completed.length > 0) {
    const latest = [...completed].sort((a, b) => latestKey(a).localeCompare(latestKey(b))).at(-1)
    const dates = [...new Set(completed.map((item) => item.row.date.trim()))].sort()
    return { answerIndex: latest?.index ?? null, dates, writtenFromIncomplete: false }
  }
  if (inProgress.length > 0) {
    const latest = [...inProgress].sort((a, b) => a.row.startedAt.localeCompare(b.row.startedAt)).at(-1)
    return {
      answerIndex: latest?.index ?? null,
      dates: latest ? [latest.row.date.trim()] : [],
      writtenFromIncomplete: true,
    }
  }
  return { answerIndex: null, dates: [], writtenFromIncomplete: false }
}

/**
 * Everything the letter is written from. Frozen on the report snapshot when the
 * draft is first generated.
 */
export type BackgroundReportSource = {
  /** Report date. Ages are calculated at this date. YYYY-MM-DD. */
  reportDate: string
  clientFirstName: string
  clientLastName: string
  dateOfBirth: string | null
  /** First and last name, without a title. */
  practitionerName: string
  /** Saved as written. Empty lines are dropped only when the letter is written. */
  practitionerReportIntroduction: string | null
  data: ClientBackgroundData
  screening: ScreeningAnswers | null
  /** True when no interview is completed and the letter used an in-progress one. */
  screeningFromIncomplete?: boolean
  interviews: BackgroundReportInterview[]
  /** Latest background self-report date. It is not a source line. */
  selfReportDate: string | null
  /** Self-report children count, for the existing consistency checks. */
  numberOfChildren: number | null
  referral: BackgroundReportReferral | null
}

export type BackgroundReportDraft = {
  document: LetterBodyDoc
  omitted: BackgroundReportOmission[]
}

const PARENT_ROLES: readonly RelationshipToClient[] = ["mother", "father", "parent", "step_parent"]
const CHILD_ROLES: readonly RelationshipToClient[] = ["child_biological", "child_step"]
const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]

/** Housing labels as they read after "in". Own home is built from the client's voice. */
const HOUSING_PHRASES: Record<string, string> = {
  "Private rental": "a private rental",
  "Social or community housing": "social or community housing",
  "Parent's home": "a parent's home",
  "Shared housing": "shared housing",
  "Temporary housing": "temporary housing",
  Other: "other housing",
}

const HISTORY_NOUN: Partial<Record<HistoryQuestionKey, string>> = {
  illness_injury: "a history of illness or injury",
  traumatic_events: "experiencing traumatic events",
  emotional_problems: "a history of emotional problems",
  substance_use: "a history of substance use",
  other_significant_events: "other significant life events",
}

type VoiceKind = "he" | "she" | "they" | "name"

type Voice = {
  kind: VoiceKind
  subject: string
  Subject: string
  possessive: string
  Possessive: string
  object: string
}

type Speaker = { text: string; plural: boolean }

function voiceFor(pronouns: string, sex: string, firstName: string): Voice {
  const recorded = pronouns.trim().toLowerCase()
  const fromSex = sex.trim().toLowerCase()
  const value = recorded || (fromSex === "male" ? "he" : fromSex === "female" ? "she" : "")
  const name = firstName.trim() || "the client"
  if (value.startsWith("he")) {
    return { kind: "he", subject: "he", Subject: "He", possessive: "his", Possessive: "His", object: "him" }
  }
  if (value.startsWith("she")) {
    return { kind: "she", subject: "she", Subject: "She", possessive: "her", Possessive: "Her", object: "her" }
  }
  if (value.startsWith("they")) {
    return { kind: "they", subject: "they", Subject: "They", possessive: "their", Possessive: "Their", object: "them" }
  }
  return { kind: "name", subject: name, Subject: name, possessive: `${name}'s`, Possessive: `${name}'s`, object: name }
}

/** Picks the verb that agrees with they/them. A name or he/she uses the first form. */
function verb(plural: boolean, singular: string, pluralForm: string): string {
  return plural ? pluralForm : singular
}

function speaker(voice: Voice, firstName: string, lead: boolean): Speaker {
  if (lead) return { text: firstName, plural: false }
  return { text: voice.Subject, plural: voice.kind === "they" }
}

function countWord(count: number): string {
  if (count >= 0 && count <= 9) return COUNT_WORDS[count] ?? String(count)
  return String(count)
}

function joinList(items: string[], conjunction: "and" | "or"): string {
  if (items.length <= 1) return items[0] ?? ""
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`
}

function sentence(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ""
  return /[.!?]"?$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function lowerFirst(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const firstWord = trimmed.split(/\s+/)[0] ?? ""
  if (firstWord.length > 1 && firstWord === firstWord.toUpperCase() && /[A-Za-z]/.test(firstWord)) return trimmed
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
}

function withArticle(value: string): string {
  const text = lowerFirst(value)
  if (!text) return ""
  if (/^(a|an)\s/i.test(text)) return text
  return `${/^[aeiou]/i.test(text) ? "an" : "a"} ${text}`
}

function longDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return value.trim()
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
}

function monthYear(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value.trim())
  if (!match) return value.trim()
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1)
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" })
}

function displayDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return longDate(value)
  if (/^\d{4}-\d{2}$/.test(value)) return monthYear(value)
  return value.trim()
}

function ageYears(dateOfBirth: string, asOf: string): number | null {
  const reading = assessAge(parsePartialDate(dateOfBirth), parsePartialDate(asOf), "person")
  if (reading.kind === "exact" || reading.kind === "approximate") return reading.years
  if (reading.kind === "ambiguous") return reading.high
  return null
}

function ageIsApproximate(dateOfBirth: string): boolean {
  return parsePartialDate(dateOfBirth).month == null
}

/** A year-only date is the client's age at 1 July of that year. */
function ageAtRecordedDate(
  dateOfBirth: string | null,
  precision: StartPrecision | "",
  value: string
): number | null {
  if (!dateOfBirth) return null
  const trimmed = value.trim()
  if (!trimmed || !precision) return null
  if (precision === "year") {
    const year = /^(\d{4})/.exec(trimmed)?.[1]
    if (!year) return null
    return clientAgeAtStart(dateOfBirth, "date", `${year}-07-01`)
  }
  return clientAgeAtStart(dateOfBirth, precision, trimmed)
}

function clientAgeOn(dateOfBirth: string | null, when: string): number | null {
  if (!dateOfBirth || !when.trim()) return null
  const precision = precisionForPartialDate(parsePartialDate(when))
  if (!precision) return null
  return ageAtRecordedDate(dateOfBirth, precision, when.trim())
}

function textNode(text: string): LetterBodyNode {
  return { type: "text", text }
}

function paragraph(text: string): LetterBodyNode {
  if (!text) return { type: "paragraph" }
  return { type: "paragraph", content: [textNode(text)] }
}

function numberedHeading(text: string): LetterBodyNode {
  return { type: "heading", attrs: { level: 2, numbered: true }, content: [textNode(text)] }
}

function orderedList(items: string[]): LetterBodyNode {
  return {
    type: "orderedList",
    content: items.filter(Boolean).map((text) => ({
      type: "listItem",
      content: [paragraph(text)],
    })),
  }
}

function nodeText(node: LetterBodyNode): string {
  if (node.text) return node.text
  if (!node.content) return ""
  return node.content.map(nodeText).join("")
}

/** Section and paragraph numbers as they display. A paragraph between lists does not restart the count. */
export function numberedLetterOutline(doc: LetterBodyDoc): string[] {
  let section = 0
  let item = 0
  const lines: string[] = []
  for (const node of doc.content) {
    if (node.type === "heading" && node.attrs?.numbered) {
      section += 1
      item = 0
      lines.push(`${section} ${nodeText(node)}`)
      continue
    }
    if (node.type === "paragraph") {
      const text = nodeText(node)
      if (text) lines.push(text)
      continue
    }
    if (node.type !== "orderedList") continue
    for (const child of node.content ?? []) {
      if (child.type !== "listItem") continue
      item += 1
      const label = section > 0 ? `${section}.${item}.` : `${item}.`
      lines.push(`${label} ${nodeText(child)}`)
    }
  }
  return lines
}

function answerFor(source: BackgroundReportSource, key: HistoryQuestionKey): "yes" | "no" | "not_asked" | null {
  if (key === "medication_history") return source.data.medication.previouslyTaken
  return source.screening?.[key] ?? null
}

function eventWhen(event: EventRecord, dateOfBirth: string | null): string {
  const year = /^\d{4}/.exec(event.startValue.trim())?.[0]
  const age = ageAtRecordedDate(dateOfBirth, event.startPrecision, event.startValue)
  if (!year || age == null) return ""
  const around = event.startPrecision === "year" || event.startPrecision === "age"
  return `${around ? "at around age" : "at age"} ${age} (${year})`
}

function joinWhens(whens: string[]): string {
  const parts = whens.filter(Boolean)
  if (parts.length === 0) return ""
  const rest = parts.slice(1).map((part) => part.replace(/^at\s+/, ""))
  return joinList([parts[0], ...rest], "and")
}

function describeWhens(events: EventRecord[], dateOfBirth: string | null): string {
  const sorted = [...events].sort((a, b) => compareEventsChronologically(a, b, dateOfBirth))
  return joinWhens(sorted.map((event) => eventWhen(event, dateOfBirth)))
}

function familyRoles(events: EventRecord[], relationships: RelationshipRecord[], voice: Voice): string {
  const roles: string[] = []
  for (const event of [...events].sort((a, b) => compareEventsChronologically(a, b, null))) {
    let role = ""
    if (event.relationshipRecordId) {
      const person = relationships.find((row) => row.relationshipRecordId === event.relationshipRecordId)
      if (person) role = personRoleLabel(person).toLowerCase()
    }
    if (!role) role = event.familyRelation.trim().toLowerCase()
    if (!role) role = "family member"
    if (!roles.includes(role)) roles.push(role)
  }
  return `${voice.possessive} ${joinList(roles, "and")}`
}

function historyEntryPhrase(events: EventRecord[], dateOfBirth: string | null, noun: string, fromWhen: boolean): string {
  const sorted = [...events].sort((a, b) => compareEventsChronologically(a, b, dateOfBirth))
  const titled: string[] = []
  const whens: string[] = []
  for (const event of sorted) {
    const title = event.title.trim()
    const when = eventWhen(event, dateOfBirth)
    if (title) titled.push([lowerFirst(title), when].filter(Boolean).join(" "))
    else if (when) whens.push(when)
  }
  if (titled.length === 0 && whens.length === 0) return noun
  if (titled.length === 0) {
    let whenText = joinWhens(whens)
    if (fromWhen) whenText = whenText.replace(/^at\s+/, "from ")
    return `${noun}, ${whenText}`
  }
  const parts = whens.length > 0 ? [...titled, joinWhens(whens)] : titled
  return `${noun}, including ${joinList(parts, "and")}`
}

function historySentence(
  key: HistoryQuestionKey,
  events: EventRecord[],
  dateOfBirth: string | null,
  who: Speaker,
  voice: Voice,
  relationships: RelationshipRecord[],
  family: boolean
): string {
  if (family) {
    const topic = HISTORY_QUESTIONS[key].label.replace(/^family\s+/i, "").toLowerCase()
    return `${who.text} reported a family history of ${topic} (${familyRoles(events, relationships, voice)}).`
  }
  if (key === "medication_history") {
    return `${who.text} ${verb(who.plural, "has", "have")} previously taken medication for emotional problems.`
  }
  if (key === "psychiatric_admission") {
    const whens = describeWhens(events, dateOfBirth)
    return `${who.text} ${verb(who.plural, "has", "have")} previously been admitted to a psychiatric hospital or rehabilitation service${whens ? `, ${whens}` : ""}.`
  }
  if (key === "previous_therapy") {
    const whens = describeWhens(events, dateOfBirth)
    return `${who.text} ${verb(who.plural, "has", "have")} previously attended therapy${whens ? `, ${whens}` : ""}.`
  }
  if (key === "self_harm") {
    const whens = describeWhens(events, dateOfBirth)
    return `${who.text} reported a history of self-harm${whens ? `, ${whens}` : ""}.`
  }
  const noun = HISTORY_NOUN[key] ?? `a history of ${HISTORY_QUESTIONS[key].label.toLowerCase()}`
  const phrase = historyEntryPhrase(events, dateOfBirth, noun, key === "substance_use")
  return `${who.text} reported ${phrase}.`
}

function historyItems(
  source: BackgroundReportSource,
  voice: Voice,
  first: string,
  omitted: BackgroundReportOmission[],
  family: boolean,
  named: { value: boolean }
): string[] {
  const group = HISTORY_QUESTION_GROUPS[family ? 1 : 0]
  const items: string[] = []
  let answered = false
  for (const key of group.keys) {
    const entries = eventsForQuestion(source.data.events, key, source.data.dateOfBirth)
    const recorded = answerFor(source, key)
    const answer = entries.length > 0 ? "yes" : recorded
    const label = HISTORY_QUESTIONS[key].label
    if (answer === "yes" && (entries.length > 0 || key === "medication_history")) {
      answered = true
      const who = speaker(voice, first, !named.value)
      named.value = true
      items.push(historySentence(key, entries, source.data.dateOfBirth, who, voice, source.data.relationships, family))
    } else if (answer === "yes") {
      answered = true
      omitted.push({ id: `history-${key}`, message: `${label} is Yes, with no entries.`, target: "history" })
    } else if (answer === "no") {
      answered = true
    } else if (answer === "not_asked") {
      omitted.push({ id: `history-${key}`, message: `${label} not asked`, target: "history" })
    } else {
      omitted.push({ id: `history-${key}`, message: `${label} not recorded`, target: "history" })
    }
  }
  if (family && !answered) {
    for (const key of group.keys) {
      const index = omitted.findIndex((row) => row.id === `history-${key}`)
      if (index >= 0) omitted.splice(index, 1)
    }
    omitted.push({ id: "family-history", message: "Family history not assessed", target: "history" })
  }
  return items
}

function referralName(referral: BackgroundReportReferral): string {
  return [referral.title?.trim(), referral.firstName.trim(), referral.lastName.trim()].filter(Boolean).join(" ")
}

function introductionLines(source: BackgroundReportSource, omitted: BackgroundReportOmission[]): string[] {
  const lines = (source.practitionerReportIntroduction ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length > 0) return lines
  omitted.push({
    id: "report-introduction",
    message: "Your report introduction is empty — add it in your practitioner profile",
    target: "practitioner",
  })
  const name = source.practitionerName.trim() || "the practitioner"
  return [`I am ${name}.`]
}

function sourceLines(source: BackgroundReportSource): string[] {
  const rows: { sort: string; text: string }[] = []
  const seenDates = new Set<string>()
  for (const interview of source.interviews ?? []) {
    const date = interview.date?.trim()
    if (!date || seenDates.has(date)) continue
    seenDates.add(date)
    rows.push({
      sort: date,
      text: `Clinical interview, ${displayDate(date)}.`,
    })
  }
  const referral = source.referral
  if (referral && source.data.reason.referredByMedicalProfessional === "yes") {
    const name = referralName(referral)
    if (name) {
      const profession = referral.profession?.trim().toLowerCase() ?? ""
      const date = referral.date?.trim() ?? ""
      const parts = [name, profession, date ? displayDate(date) : ""].filter(Boolean)
      rows.push({ sort: date || "9999-99-99", text: `Referral from ${parts.join(", ")}.` })
    }
  }
  rows.sort((a, b) => a.sort.localeCompare(b.sort))
  return rows.map((row) => row.text)
}

function presentingItems(
  source: BackgroundReportSource,
  voice: Voice,
  first: string,
  omitted: BackgroundReportOmission[]
): string[] {
  const { reason } = source.data
  const items: string[] = []
  const referred = reason.referredByMedicalProfessional
  if (referred === "yes" && source.referral && referralName(source.referral)) {
    const profession = source.referral.profession?.trim().toLowerCase()
    const name = referralName(source.referral)
    const by = profession ? `${voice.possessive} ${profession}, ${name}` : name
    let line = `${first} was referred by ${by}`
    if (source.referral.date?.trim()) line += `, on ${displayDate(source.referral.date)}`
    if (reason.referrerConcerns.trim()) line += `, with concerns about ${reason.referrerConcerns.trim()}`
    else {
      omitted.push({ id: "referrer-concerns", message: "Referrer's concerns not recorded", target: "reason" })
    }
    items.push(`${line}.`)
  } else if (referred === "not_asked") {
    omitted.push({ id: "referral", message: "Referral not asked", target: "reason" })
  } else if (referred == null) {
    omitted.push({ id: "referral", message: "Referral not recorded", target: "reason" })
  }

  if (reason.familyInvolved === "yes") {
    items.push(
      reason.familyInvolvement.trim()
        ? sentence(reason.familyInvolvement)
        : `${voice.Possessive} family were involved in ${voice.object} attending.`
    )
  } else if (reason.familyInvolved === "not_asked") {
    omitted.push({ id: "family-involvement", message: "Family involvement not asked", target: "reason" })
  } else if (reason.familyInvolved == null) {
    omitted.push({ id: "family-involvement", message: "Family involvement not recorded", target: "reason" })
  }

  const yesStressors: string[] = []
  let stressorAnswered = false
  for (const item of STRESSOR_ITEMS) {
    const answer = source.data.stressors[item.key]
    if (answer === "yes" || answer === "no") stressorAnswered = true
    if (answer === "yes") yesStressors.push(item.label.toLowerCase())
  }
  if (!stressorAnswered) {
    omitted.push({ id: "stressors", message: "Current stressors not assessed", target: "stressors" })
  } else {
    if (yesStressors.length > 0) {
      items.push(`${first} reported current difficulties with ${joinList(yesStressors, "and")}.`)
    }
    for (const item of STRESSOR_ITEMS) {
      if (source.data.stressors[item.key] === "not_asked") {
        omitted.push({ id: `stressor-${item.key}`, message: `${item.label} not asked`, target: "stressors" })
      }
    }
  }

  if (source.data.stressors.mainReason.trim()) {
    items.push(
      `${voice.Subject} described the main problem as "${source.data.stressors.mainReason.trim()}".`
    )
  } else {
    omitted.push({
      id: "main-reason",
      message: "Client's own description of the problem not recorded",
      target: "stressors",
    })
  }

  const attended: string[] = []
  if (reason.ownInitiative === "yes") attended.push(`on ${voice.possessive} own initiative`)
  else if (reason.ownInitiative === "no") attended.push("at the encouragement of others")
  else if (reason.ownInitiative === "not_asked") {
    omitted.push({ id: "own-initiative", message: "Own initiative not asked", target: "reason" })
  } else omitted.push({ id: "own-initiative", message: "Own initiative not recorded", target: "reason" })

  if (reason.attendedWillingly === "yes") attended.push("willingly")
  else if (reason.attendedWillingly === "somewhat") attended.push("somewhat willingly")
  else if (reason.attendedWillingly === "no") attended.push("reluctantly")
  else if (reason.attendedWillingly === "not_asked") {
    omitted.push({ id: "willingness", message: "Willingness to attend not asked", target: "reason" })
  } else omitted.push({ id: "willingness", message: "Willingness to attend not recorded", target: "reason" })

  if (attended.length > 0) {
    items.push(`${voice.Subject} attended ${joinList(attended, "and")}.`)
  }
  if (reason.clientMotivation.trim()) items.push(sentence(reason.clientMotivation))
  else omitted.push({ id: "motivation", message: "Client's motivation not recorded", target: "reason" })

  return items
}

function partnerNoun(status: ClientRelationshipStatus | "", sex: string): string {
  const value = sex.trim().toLowerCase()
  if (status === "married") {
    if (value === "female") return "wife"
    if (value === "male") return "husband"
  }
  if (value === "female") return "female partner"
  if (value === "male") return "male partner"
  return "partner"
}

function partnerLength(partner: RelationshipRecord | undefined): string {
  const value = partner?.lengthOfRelationship.trim() ?? ""
  if (!value) return ""
  if (/^\d+$/.test(value)) return `${value} years`
  return value.replace(/^of\s+/i, "")
}

function people(records: RelationshipRecord[], roles: readonly RelationshipToClient[]): RelationshipRecord[] {
  return records.filter((row) => roles.includes(row.relationshipToClient))
}

function ageList(rows: RelationshipRecord[], asOf: string): string[] {
  return rows
    .map((row) => {
      if (!row.dateOfBirth) return null
      const years = ageYears(row.dateOfBirth, asOf)
      if (years == null) return null
      return { years, about: ageIsApproximate(row.dateOfBirth) }
    })
    .filter((row): row is { years: number; about: boolean } => Boolean(row))
    .sort((a, b) => b.years - a.years)
    .map((row) => (row.about ? `about ${row.years}` : String(row.years)))
}

function relationshipItem(source: BackgroundReportSource, voice: Voice, who: Speaker): string | null {
  const status = source.data.relationshipStatus.relationshipStatus
  if (!status) return null
  const partner = source.data.relationships.find((row) => row.relationshipToClient === "current_partner")
  const prior = source.data.relationships.filter((row) => row.relationshipToClient === "prior_partner")
  const length = partnerLength(partner)
  const noun = partnerNoun(status, partner?.sex ?? "")
  const has = verb(who.plural, "has", "have")
  const is = verb(who.plural, "is", "are")
  let line = ""
  if (status === "single" || status === "separated" || status === "divorced" || status === "widowed") {
    line = `${who.text} ${is} ${CLIENT_RELATIONSHIP_STATUS_LABELS[status].toLowerCase()}`
  } else if (status === "married") {
    line = partner
      ? length
        ? `${who.text} ${has} been married to ${voice.possessive} ${noun} for ${length}`
        : `${who.text} ${is} married to ${voice.possessive} ${noun}`
      : `${who.text} ${is} married`
  } else if (status === "defacto") {
    line = `${who.text} ${is} in a de facto relationship with ${voice.possessive} ${noun}${length ? ` of ${length}` : ""}`
  } else if (status === "engaged") {
    line = `${who.text} ${is} engaged${partner ? ` to ${voice.possessive} ${noun}` : ""}`
  } else if (status === "in_relationship_not_living_together") {
    line = `${who.text} ${is} in a relationship${partner ? ` with ${voice.possessive} ${noun}` : ""}${length ? ` of ${length}` : ""}`
  } else {
    const other = source.data.relationshipStatus.relationshipStatusOther.trim()
    line = `${who.text} ${is} ${other ? lowerFirst(other) : "in another relationship"}`
  }
  if (prior.length > 0) {
    const nounCount = prior.length === 1 ? "relationship" : "relationships"
    line += `, and ${has} had ${countWord(prior.length)} previous significant ${nounCount}`
  }
  return `${line}.`
}

function parentsItem(
  source: BackgroundReportSource,
  voice: Voice,
  first: string,
  omitted: BackgroundReportOmission[]
): string | null {
  const bits: string[] = []
  const link = canonicalParentsLink(source.data.relationships, source.data.partnerships)
  const status = link.partnership?.relationshipStatus
  if (status === "separated" || status === "divorced") {
    const ended = link.partnership?.ended.trim() ?? ""
    const age = ended ? clientAgeOn(source.dateOfBirth, ended) : null
    const verbWas = verb(voice.kind === "they", "was", "were")
    if (age != null) {
      bits.push(`${voice.Possessive} parents ${status} when ${voice.subject} ${verbWas} ${age}.`)
    } else {
      bits.push(`${voice.Possessive} parents are ${status}.`)
      omitted.push({
        id: "parents-ended",
        message: `When ${voice.possessive} parents separated not recorded`,
        target: "relationships",
      })
    }
  }
  for (const parent of people(source.data.relationships, PARENT_ROLES)) {
    if (parent.healthStatus !== "deceased" && !parent.deceased) continue
    const role = personRoleLabel(parent).toLowerCase()
    const age = parent.dateOfDeath ? clientAgeOn(source.dateOfBirth, parent.dateOfDeath) : null
    if (parent.dateOfDeath && age != null) {
      bits.push(`${voice.Possessive} ${role} died when ${first} was ${age}.`)
    } else if (!parent.dateOfDeath) {
      bits.push(`${voice.Possessive} ${role} is deceased.`)
      omitted.push({
        id: `death-${parent.relationshipRecordId || role}`,
        message: `${personRoleLabel(parent)}'s year of death not recorded`,
        target: "relationships",
      })
    } else {
      const year = parsePartialDate(parent.dateOfDeath).year
      bits.push(year ? `${voice.Possessive} ${role} died in ${year}.` : `${voice.Possessive} ${role} is deceased.`)
    }
  }
  return bits.length > 0 ? bits.join(" ") : null
}

function countedPhrase(count: number, singular: string, plural: string, ages: string[]): string {
  const noun = `${countWord(count)} ${count === 1 ? singular : plural}`
  if (ages.length === 0) return noun
  if (ages.length === count) return `${noun}, aged ${joinList(ages, "and")}`
  return `${noun}, ${countWord(ages.length)} aged ${joinList(ages, "and")}`
}

function siblingItem(source: BackgroundReportSource, who: Speaker): string | null {
  const groups: { roles: RelationshipToClient[]; singular: string; plural: string }[] = [
    { roles: ["sibling_full"], singular: "sibling", plural: "siblings" },
    { roles: ["sibling_half"], singular: "half-sibling", plural: "half-siblings" },
    { roles: ["sibling_step"], singular: "step-sibling", plural: "step-siblings" },
  ]
  const parts: string[] = []
  for (const group of groups) {
    const rows = people(source.data.relationships, group.roles)
    if (rows.length === 0) continue
    parts.push(countedPhrase(rows.length, group.singular, group.plural, ageList(rows, source.reportDate)))
  }
  if (parts.length === 0) return null
  const listed = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`
  return `${who.text} ${verb(who.plural, "has", "have")} ${listed}.`
}

function childrenItem(source: BackgroundReportSource, who: Speaker): string | null {
  const rows = people(source.data.relationships, CHILD_ROLES)
  if (rows.length === 0) return null
  const phrase = countedPhrase(rows.length, "child", "children", ageList(rows, source.reportDate))
  return `${who.text} ${verb(who.plural, "has", "have")} ${phrase}.`
}

function cultureItem(source: BackgroundReportSource, voice: Voice, who: Speaker): string | null {
  const identity = source.data.demographics.identity
  const culture = identity.raceEthnicity.trim()
  const language = identity.primaryLanguage.trim()
  const religion = identity.religion.trim()
  const identify = verb(who.plural, "identifies", "identify")
  const speak = verb(who.plural, "speaks", "speak")
  const is = verb(who.plural, "is", "are")
  if (culture && language && religion) {
    return `${who.text} ${identify} as ${culture}, ${speak} ${language} at home and ${is} ${religion}.`
  }
  if (culture && language) return `${who.text} ${identify} as ${culture} and ${speak} ${language} at home.`
  if (culture && religion) return `${who.text} ${identify} as ${culture} and ${is} ${religion}.`
  if (language && religion) return `${who.text} ${speak} ${language} at home and ${is} ${religion}.`
  if (culture) return `${who.text} ${identify} as ${culture}.`
  if (language) return `${who.text} ${speak} ${language} at home.`
  if (religion) return `${who.text} ${is} ${religion}.`
  return null
}

function ageItem(source: BackgroundReportSource, voice: Voice): string | null {
  const identity = source.data.demographics.identity
  const years = source.dateOfBirth ? ageYears(source.dateOfBirth, source.reportDate) : null
  const sex = identity.sex.trim().toLowerCase()
  const sexWord = sex === "male" || sex === "female" ? sex : ""
  const gender = identity.genderIdentity.trim()
  const pronouns = identity.pronouns.trim()
  const first = source.clientFirstName.trim() || "the client"
  if (years == null || !sexWord) return null
  const pronounBit = pronouns ? ` (${pronouns})` : ""
  if (gender) {
    const identify = verb(voice.kind === "they", "identifies", "identify")
    return `${first} is a ${years}-year-old ${sexWord}; ${voice.subject} ${identify} as ${lowerFirst(gender)}${pronounBit}.`
  }
  return `${first} is a ${years}-year-old ${sexWord}${pronounBit}.`
}

function livingItem(source: BackgroundReportSource, voice: Voice, who: Speaker): string | null {
  const living = source.data.demographics.livingSituation
  const status = source.data.relationshipStatus.relationshipStatus
  const partner = source.data.relationships.find((row) => row.relationshipToClient === "current_partner")
  const lives = verb(who.plural, "lives", "live")
  const has = verb(who.plural, "has", "have")
  let home = ""
  if (living.livesWith === "alone") home = `${who.text} ${lives} alone`
  else if (living.livesWith === "no_fixed_address") home = `${who.text} ${has} no fixed address`
  else if (living.livesWith) {
    const raw = living.livesWith === "other" ? living.livesWithOther : LIVES_WITH_LABELS[living.livesWith]
    let whoWith = lowerFirst(raw.replace(/^With\s+/i, ""))
    const noun = partnerNoun(status, partner?.sex ?? "")
    if ((noun === "wife" || noun === "husband") && whoWith.startsWith("partner")) {
      whoWith = whoWith.replace(/^partner/, noun)
    }
    home = `${who.text} ${lives} with ${voice.possessive} ${whoWith}`
  }
  const housingLabel = living.housingType.trim()
  const housing =
    housingLabel === "Own home"
      ? `${voice.possessive} own home`
      : housingLabel
        ? (HOUSING_PHRASES[housingLabel] ?? withArticle(housingLabel))
        : ""
  const stability =
    living.housingStability === "Stable"
      ? "stable"
      : living.housingStability === "Some concern"
        ? "having some concern"
        : living.housingStability === "Unstable"
          ? "unstable"
          : ""
  const describes = stability
    ? `${verb(who.plural, "describes", "describe")} ${voice.possessive} housing as ${stability}`
    : ""
  if (home && housing && describes) return `${home} in ${housing} and ${describes}.`
  if (home && describes) return `${home} and ${describes}.`
  if (home && housing) return `${home} in ${housing}.`
  if (home) return `${home}.`
  if (housing && describes) return `${who.text} ${lives} in ${housing} and ${describes}.`
  if (housing) return `${who.text} ${lives} in ${housing}.`
  if (describes) return `${who.text} ${describes}.`
  return null
}

function educationItem(source: BackgroundReportSource, voice: Voice, who: Speaker): string | null {
  const education = source.data.demographics.education
  const parts: string[] = []
  if (education.level.trim()) {
    const field = education.fieldOfStudy.trim()
    parts.push(
      `${voice.Possessive} highest level of education is ${withArticle(education.level)}${field ? ` in ${lowerFirst(field)}` : ""}.`
    )
  }
  if (education.currentlyStudying === true) {
    const detail = education.currentlyStudyingDetail.trim()
    parts.push(
      detail
        ? `${who.text} ${verb(who.plural, "is", "are")} currently studying ${detail}.`
        : `${who.text} ${verb(who.plural, "is", "are")} currently studying.`
    )
  }
  return parts.length > 0 ? parts.join(" ") : null
}

function mostRecentRole(source: BackgroundReportSource): string {
  const jobs = [...source.data.demographics.occupation.previousJobs]
  jobs.sort((a, b) => (b.ended || b.started).localeCompare(a.ended || a.started))
  return jobs.find((job) => job.role.trim())?.role.trim() ?? ""
}

function workItem(source: BackgroundReportSource, who: Speaker): string | null {
  const occupation = source.data.demographics.occupation
  if (!occupation.workStatus) return null
  const is = verb(who.plural, "is", "are")
  const works = verb(who.plural, "works", "work")
  const role = occupation.role.trim()
  const asRole = role ? ` as ${withArticle(role)}` : ""
  const previous = mostRecentRole(source)
  const previousClause = previous ? `, and previously worked as ${withArticle(previous)}` : ""
  switch (occupation.workStatus) {
    case "full_time":
      return `${who.text} ${works} full-time${asRole}.`
    case "part_time":
      return `${who.text} ${works} part-time${asRole}.`
    case "casual":
      return `${who.text} ${works} casually${asRole}.`
    case "self_employed":
      return `${who.text} ${is} self-employed${asRole}.`
    case "student":
      return `${who.text} ${is} studying.`
    case "retired":
      return `${who.text} ${is} retired${previousClause}.`
    case "home_duties_or_carer":
      return `${who.text} ${verb(who.plural, "has", "have")} home duties or caring responsibilities.`
    case "unable_to_work":
      return `${who.text} ${is} unable to work${previousClause}.`
    case "unemployed":
      return previous
        ? `${who.text} ${is} not currently working, and previously worked as ${withArticle(previous)}.`
        : `${who.text} ${is} not currently working.`
    case "other": {
      const other = lowerFirst(occupation.workStatusOther.trim())
      if (other && role) return `${who.text} ${is} ${other} and ${works}${asRole}.`
      if (other) return `${who.text} ${is} ${other}.`
      if (role) return `${who.text} ${works}${asRole}.`
      return `${who.text} ${is} in other work.`
    }
    default:
      return null
  }
}

function necessitiesKnown(source: BackgroundReportSource): boolean {
  const occupation = source.data.demographics.occupation
  if (occupation.workStatus || occupation.role.trim() || occupation.previousJobs.length > 0) return true
  if (source.selfReportDate) return true
  return NECESSITY_KEYS.some((key) => occupation.necessities[key])
}

function necessitiesItem(source: BackgroundReportSource, who: Speaker): string | null {
  if (!necessitiesKnown(source)) return null
  const ticked = NECESSITY_KEYS.filter((key) => source.data.demographics.occupation.necessities[key]).map((key) =>
    NECESSITY_LABELS[key].toLowerCase()
  )
  if (ticked.length === 0) {
    return `${who.text} reported no difficulty affording basic necessities.`
  }
  return `${who.text} reported difficulty affording ${joinList(ticked, "and")}.`
}

function disabilityItem(source: BackgroundReportSource, who: Speaker): string | null {
  const identity = source.data.demographics.identity
  if (identity.disability === false) return `${who.text} reported no disability.`
  if (identity.disability === true) {
    return identity.disabilityDetail.trim()
      ? `${who.text} reported a disability: ${lowerFirst(identity.disabilityDetail).replace(/\.$/, "")}.`
      : `${who.text} reported a disability.`
  }
  return null
}

function medicationItem(source: BackgroundReportSource, who: Speaker): string | null {
  const taking = source.data.medication.currentlyTaking
  const is = verb(who.plural, "is", "are")
  if (taking === "no") return `${who.text} ${is} not currently taking medication for emotional problems.`
  if (taking === "yes") {
    const supervisor = source.data.medication.supervisedBy.trim()
    return supervisor
      ? `${who.text} ${is} currently taking medication for emotional problems, supervised by ${supervisor}.`
      : `${who.text} ${is} currently taking medication for emotional problems.`
  }
  return null
}

function demographicItems(
  source: BackgroundReportSource,
  voice: Voice,
  omitted: BackgroundReportOmission[]
): string[] {
  const first = source.clientFirstName.trim() || "the client"
  const items: string[] = []
  let named = false
  const next = (build: (who: Speaker) => string | null, forceLead = false): void => {
    const who = speaker(voice, first, forceLead || !named)
    const text = build(who)
    if (!text) return
    named = true
    items.push(text)
  }

  const age = ageItem(source, voice)
  if (age) {
    named = true
    items.push(age)
  }
  next((who) => cultureItem(source, voice, who))
  next((who) => relationshipItem(source, voice, who))
  next((who) => childrenItem(source, who))
  const parents = parentsItem(source, voice, first, omitted)
  if (parents) {
    named = true
    items.push(parents)
  }
  next((who) => siblingItem(source, who))
  next((who) => livingItem(source, voice, who))
  next((who) => educationItem(source, voice, who))
  next((who) => workItem(source, who))
  next((who) => necessitiesItem(source, who))
  next((who) => disabilityItem(source, who))
  next((who) => medicationItem(source, who))
  return items
}

function pushNumberedSection(
  content: LetterBodyNode[],
  title: string,
  blocks: { heading?: string; items: string[] }[],
  placeholder?: string
) {
  content.push(numberedHeading(title))
  let wrote = false
  for (const block of blocks) {
    if (block.items.length === 0) continue
    wrote = true
    if (block.heading) content.push(paragraph(block.heading))
    content.push(orderedList(block.items))
  }
  if (!wrote && placeholder) content.push(orderedList([placeholder]))
}

export function generateBackgroundReport(source: BackgroundReportSource): BackgroundReportDraft {
  const first = source.clientFirstName.trim() || "the client"
  const full = [first, source.clientLastName.trim()].filter(Boolean).join(" ")
  const voice = voiceFor(
    source.data.demographics.identity.pronouns,
    source.data.demographics.identity.sex,
    first
  )
  const omitted: BackgroundReportOmission[] = []
  if (source.screeningFromIncomplete) {
    omitted.push({
      id: "interview-incomplete",
      message: "Report written from an interview that is not yet completed",
      target: "interview",
    })
  }
  const named = { value: false }
  const clientHistory = historyItems(source, voice, first, omitted, false, named)
  const familyHistory = historyItems(source, voice, first, omitted, true, named)
  const historyBlocks: { heading?: string; items: string[] }[] = []
  if (clientHistory.length > 0) historyBlocks.push({ heading: "Client history", items: clientHistory })
  if (familyHistory.length > 0) historyBlocks.push({ heading: "Family history", items: familyHistory })
  if (clientHistory.length === 0 && familyHistory.length === 0) {
    historyBlocks.push({ items: ["[Relevant history — not yet recorded.]"] })
  }
  historyBlocks.push({ items: ["[Alcohol and other drugs — to be added (ASSIST).]"] })
  const content: LetterBodyNode[] = []

  pushNumberedSection(content, "Purpose and Scope", [
    {
      items: [
        ...introductionLines(source, omitted),
        `This report summarises my background assessment of ${full}.`,
        `The report addresses ${first}'s presenting problem, demographics, relevant history and risk.`,
      ],
    },
  ])
  pushNumberedSection(content, "Sources", [{ items: sourceLines(source) }])
  pushNumberedSection(
    content,
    "Presenting Problem",
    [{ items: presentingItems(source, voice, first, omitted) }],
    "[Presenting problem — not yet recorded.]"
  )
  pushNumberedSection(
    content,
    "Demographics",
    [{ items: demographicItems(source, voice, omitted) }],
    "[Demographics — not yet recorded.]"
  )
  pushNumberedSection(content, "Relevant History", historyBlocks)
  pushNumberedSection(content, "Risk Assessment", [{ items: ["[Risk assessment — to be added (LRAMP).]"] }])
  pushNumberedSection(content, "Summary", [{ items: ["[Summary — practitioner to write.]"] }])
  content.push(paragraph("Yours sincerely,"))

  return { document: { type: "doc", content }, omitted }
}
