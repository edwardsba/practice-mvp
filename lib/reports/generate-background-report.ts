import { assessAge, compareEventsChronologically, describeClientAge } from "@/lib/client-background/age"
import {
  HISTORY_QUESTION_GROUPS,
  HISTORY_QUESTIONS,
  eventsForQuestion,
  type HistoryQuestionKey,
  type ScreeningAnswers,
} from "@/lib/client-background/interview-history"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import { personRoleLabel } from "@/lib/client-background/tree"
import {
  CLIENT_RELATIONSHIP_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  HEALTH_STATUS_LABELS,
  LIVES_WITH_LABELS,
  PARTNERSHIP_STATUS_LABELS,
  STRESSOR_ITEMS,
  WORK_STATUS_LABELS,
  type ClientBackgroundData,
  type ClientRelationshipStatus,
  type EventRecord,
  type HealthStatus,
  type RelationshipRecord,
  type RelationshipToClient,
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
  /** YYYY-MM-DD when known. */
  date: string | null
}

export type BackgroundReportQuestionnaire = {
  fullName: string
  abbreviation: string
  /** YYYY-MM-DD completion dates. */
  dates: string[]
}

export type BackgroundReportSageModule = {
  name: "Core" | "Background" | "Personality"
  /** YYYY-MM-DD. */
  date: string
}

/**
 * Everything the letter is written from. Frozen on the report snapshot at the
 * moment the draft is first generated.
 */
export type BackgroundReportSource = {
  /** Report date. Ages are calculated at this date. YYYY-MM-DD. */
  reportDate: string
  clientFirstName: string
  clientLastName: string
  dateOfBirth: string | null
  practitionerName: string
  profession: string | null
  yearRegistered: string | null
  data: ClientBackgroundData
  screening: ScreeningAnswers | null
  /** Latest interview date, YYYY-MM-DD. Null when there has been no interview. */
  interviewDate: string | null
  /** Latest background self-report date, YYYY-MM-DD. */
  selfReportDate: string | null
  /** Self-report children count, for the existing consistency checks. */
  numberOfChildren: number | null
  sageModules: BackgroundReportSageModule[]
  questionnaires: BackgroundReportQuestionnaire[]
  /** First attended (completed) appointment, YYYY-MM-DD. */
  firstAttendedAppointment: string | null
  referral: BackgroundReportReferral | null
}

export type BackgroundReportDraft = {
  document: LetterBodyDoc
  omitted: BackgroundReportOmission[]
}

const PARTNER_EXPECTED: readonly ClientRelationshipStatus[] = [
  "in_relationship_not_living_together",
  "engaged",
  "defacto",
  "married",
]

const CHILD_ROLES: readonly RelationshipToClient[] = ["child_biological", "child_step"]
const PARENT_ROLES: readonly RelationshipToClient[] = ["mother", "father", "parent", "step_parent"]

const CLIENT_DENIED: Record<string, string> = {
  illness_injury: "significant illness or injury",
  traumatic_events: "traumatic events",
  emotional_problems: "emotional problems",
  substance_use: "substance use",
  self_harm: "history of self-harm",
  psychiatric_admission: "admission to a psychiatric hospital or rehabilitation service",
  previous_therapy: "previous individual or group therapy",
  medication_history: "previous medication for emotional problems",
  other_significant_events: "other significant events",
}

const FAMILY_DENIED: Record<string, string> = {
  family_illness: "illness",
  family_emotional_problems: "emotional problems",
  family_substance_use: "substance use",
  family_self_harm: "self-harm",
  family_psychiatric_admission: "psychiatric hospital or rehabilitation admission",
  family_significant_events: "other significant events",
}

type Voice = {
  subject: string
  Subject: string
  possessive: string
  Possessive: string
}

function voiceFor(pronouns: string, firstName: string): Voice {
  const value = pronouns.trim().toLowerCase()
  if (value.startsWith("he")) {
    return { subject: "he", Subject: "He", possessive: "his", Possessive: "His" }
  }
  if (value.startsWith("she")) {
    return { subject: "she", Subject: "She", possessive: "her", Possessive: "Her" }
  }
  if (value.startsWith("they")) {
    return { subject: "they", Subject: "They", possessive: "their", Possessive: "Their" }
  }
  const name = firstName.trim() || "the client"
  return { subject: name, Subject: name, possessive: `${name}'s`, Possessive: `${name}'s` }
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

function dobLabel(value: string | null): string | null {
  if (!value?.trim()) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return longDate(value)
  if (/^\d{4}-\d{2}$/.test(value)) return monthYear(value)
  if (/^\d{4}$/.test(value)) return value
  return value.trim()
}

function agePhrase(dateOfBirth: string, asOf: string): string | null {
  const reading = assessAge(parsePartialDate(dateOfBirth), parsePartialDate(asOf), "person")
  if (reading.kind === "exact") return String(reading.years)
  if (reading.kind === "approximate") return `about ${reading.years}`
  if (reading.kind === "ambiguous") return `about ${reading.high}`
  return null
}

function lowerFirst(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
}

function textNode(text: string): LetterBodyNode {
  return { type: "text", text }
}

function paragraph(text: string, bold = false): LetterBodyNode {
  if (!text) return { type: "paragraph" }
  return {
    type: "paragraph",
    content: [bold ? { ...textNode(text), marks: [{ type: "bold" }] } : textNode(text)],
  }
}

function numberedHeading(text: string): LetterBodyNode {
  return {
    type: "heading",
    attrs: { level: 2, numbered: true },
    content: [textNode(text)],
  }
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

/** Section and paragraph numbers as they will display. Numbers are not stored in the text. */
export function numberedLetterOutline(doc: LetterBodyDoc): string[] {
  let section = 0
  const lines: string[] = []
  for (const node of doc.content) {
    if (node.type === "heading" && node.attrs?.numbered) {
      section += 1
      lines.push(`${section} ${nodeText(node)}`)
    }
    if (node.type !== "orderedList") continue
    let item = 0
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
  const reading = describeClientAge(dateOfBirth, event.startPrecision, event.startValue)
  const year = /^\d{4}/.exec(event.startValue.trim())?.[0]
  if (event.startPrecision === "date" && (reading.kind === "exact" || reading.kind === "approximate")) {
    const age = reading.kind === "approximate" ? `about ${reading.years}` : String(reading.years)
    return `at age ${age} (${longDate(event.startValue)})`
  }
  if ((reading.kind === "exact" || reading.kind === "approximate") && year) {
    return `at around age ${reading.years} (${year})`
  }
  if (event.startPrecision === "date" && event.startValue) return `on ${longDate(event.startValue)}`
  if (year) return `in ${year}`
  return ""
}

function eventTitle(event: EventRecord): string {
  const title = event.title.trim()
  if (title) return lowerFirst(title)
  return lowerFirst(EVENT_TYPE_LABELS[event.eventType] ?? "an event")
}

function joinWhens(whens: string[]): string {
  const parts = whens.filter(Boolean)
  if (parts.length === 0) return ""
  const rest = parts.slice(1).map((part) => part.replace(/^at\s+/, ""))
  return joinList([parts[0], ...rest], "and")
}

function joinClauses(clauses: string[]): string {
  if (clauses.length <= 1) return clauses[0] ?? ""
  if (clauses.length === 2 && clauses[0].includes(" and ")) {
    return `${clauses[0]}, and ${clauses[1]}`
  }
  return joinList(clauses, "and")
}

function describeEntries(events: EventRecord[], dateOfBirth: string | null): string {
  const sorted = [...events].sort((a, b) => compareEventsChronologically(a, b, dateOfBirth))
  const groups: { title: string; whens: string[] }[] = []
  for (const event of sorted) {
    const title = eventTitle(event)
    const when = eventWhen(event, dateOfBirth)
    const last = groups[groups.length - 1]
    if (last && last.title === title) last.whens.push(when)
    else groups.push({ title, whens: [when] })
  }
  return joinClauses(
    groups.map((group) => [group.title, joinWhens(group.whens)].filter(Boolean).join(" "))
  )
}

function familyMember(event: EventRecord, relationships: RelationshipRecord[], voice: Voice): string {
  if (event.relationshipRecordId) {
    const person = relationships.find((row) => row.relationshipRecordId === event.relationshipRecordId)
    if (person) return `${voice.possessive} ${personRoleLabel(person).toLowerCase()}`
  }
  const relation = event.familyRelation.trim()
  if (relation) return `${voice.possessive} ${relation.toLowerCase()}`
  return "a family member"
}

function describeFamilyEntries(
  events: EventRecord[],
  relationships: RelationshipRecord[],
  dateOfBirth: string | null,
  voice: Voice
): string {
  const sorted = [...events].sort((a, b) => compareEventsChronologically(a, b, dateOfBirth))
  const clauses = sorted.map((event) => {
    const title = eventTitle(event)
    const who = familyMember(event, relationships, voice)
    const when = eventWhen(event, dateOfBirth)
    return [`a family history of ${title}`, `in ${who}`, when].filter(Boolean).join(" ")
  })
  return joinList(clauses, "and")
}

function yesWithoutEntries(key: HistoryQuestionKey, voice: Voice, family: boolean): string {
  if (!family && key === "psychiatric_admission") {
    return `${voice.Subject} has previously been admitted to a psychiatric hospital or rehabilitation service.`
  }
  if (!family && key === "medication_history") {
    return `${voice.Subject} has previously taken medication for emotional problems.`
  }
  const heading = HISTORY_QUESTIONS[key].label.toLowerCase()
  if (family) return `${voice.Subject} reported a family history of ${FAMILY_DENIED[key] ?? heading}.`
  return `${voice.Subject} reported a history of ${heading}.`
}

function historyParagraphs(
  source: BackgroundReportSource,
  voice: Voice,
  omitted: BackgroundReportOmission[],
  family: boolean
): string[] {
  const group = HISTORY_QUESTION_GROUPS[family ? 1 : 0]
  const paragraphs: string[] = []
  const denied: string[] = []
  let answered = false

  for (const key of group.keys) {
    const entries = eventsForQuestion(source.data.events, key, source.data.dateOfBirth)
    const answer = entries.length > 0 ? "yes" : answerFor(source, key)
    const label = HISTORY_QUESTIONS[key].label
    if (answer === "yes") {
      answered = true
      if (entries.length > 0) {
        const described = family
          ? describeFamilyEntries(entries, source.data.relationships, source.data.dateOfBirth, voice)
          : describeEntries(entries, source.data.dateOfBirth)
        paragraphs.push(`${voice.Subject} reported ${described}.`)
      } else {
        paragraphs.push(yesWithoutEntries(key, voice, family))
      }
    } else if (answer === "no") {
      answered = true
      denied.push((family ? FAMILY_DENIED : CLIENT_DENIED)[key] ?? label.toLowerCase())
    } else if (answer === "not_asked") {
      omitted.push({ id: `history-${key}`, message: `${label} not asked`, target: "history" })
    } else {
      omitted.push({ id: `history-${key}`, message: `${label} not recorded`, target: "history" })
    }
  }

  if (denied.length > 0) {
    const list = joinList(denied, "or")
    paragraphs.push(
      family
        ? `${voice.Subject} denied any family history of ${list}.`
        : `${voice.Subject} denied any ${list}.`
    )
  }

  if (family && !answered) {
    for (const key of group.keys) {
      const index = omitted.findIndex((row) => row.id === `history-${key}`)
      if (index >= 0) omitted.splice(index, 1)
    }
    omitted.push({ id: "family-history", message: "Family history not assessed", target: "history" })
  }

  return paragraphs
}

function people(records: RelationshipRecord[], roles: readonly RelationshipToClient[]): RelationshipRecord[] {
  return records.filter((row) => roles.includes(row.relationshipToClient))
}

function agedList(peopleRows: RelationshipRecord[], asOf: string): string[] {
  return peopleRows
    .map((person) => (person.dateOfBirth ? agePhrase(person.dateOfBirth, asOf) : null))
    .filter((age): age is string => Boolean(age))
}

function countPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function sageSentence(modules: BackgroundReportSageModule[]): string | null {
  if (modules.length === 0) return null
  const order = ["Core", "Background", "Personality"] as const
  const names = order.filter((name) => modules.some((module) => module.name === name))
  const dates = [...modules.map((module) => module.date)].sort()
  const first = dates[0]
  const last = dates[dates.length - 1]
  let completed = longDate(first)
  if (first !== last) {
    const sameMonth = first.slice(0, 7) === last.slice(0, 7)
    completed = sameMonth
      ? `${Number(first.slice(8, 10))}–${Number(last.slice(8, 10))} ${monthYear(first)}`
      : `between ${longDate(first)} and ${longDate(last)}`
  }
  const label = names.length === 1 ? `${names[0]} module` : `${joinList([...names], "and")} modules`
  return `The SAGE-SR ${label} completed ${completed}.`
}

function questionnaireSentence(
  questionnaires: BackgroundReportQuestionnaire[],
  selfReportDate: string | null
): string | null {
  const parts: string[] = []
  for (const instrument of questionnaires) {
    const dates = [...instrument.dates].filter(Boolean).sort()
    if (dates.length === 0) continue
    const when =
      dates.length === 1
        ? longDate(dates[0])
        : `between ${monthYear(dates[0])} and ${monthYear(dates[dates.length - 1])}`
    parts.push(`the ${instrument.fullName} (${instrument.abbreviation}) completed ${when}`)
  }
  if (selfReportDate) {
    parts.push(`the background self-report questionnaire completed ${longDate(selfReportDate)}`)
  }
  if (parts.length === 0) return null
  const joined = joinList(parts, "and")
  return sentence(joined.charAt(0).toUpperCase() + joined.slice(1))
}

function interviewSentence(source: BackgroundReportSource): string | null {
  const commenced = source.firstAttendedAppointment
    ? `Clinical interviews and treatment commenced in ${monthYear(source.firstAttendedAppointment)}`
    : ""
  if (commenced && source.interviewDate) {
    return `${commenced}, including a background interview on ${longDate(source.interviewDate)}.`
  }
  if (commenced) return `${commenced}.`
  if (source.interviewDate) return `A background interview was completed on ${longDate(source.interviewDate)}.`
  return null
}

function referralName(referral: BackgroundReportReferral): string {
  return [referral.title?.trim(), referral.firstName.trim(), referral.lastName.trim()].filter(Boolean).join(" ")
}

function collateralSentence(source: BackgroundReportSource, voice: Voice): string | null {
  const referral = source.referral
  if (!referral) return null
  if (source.data.reason.referredByMedicalProfessional !== "yes") return null
  const name = referralName(referral)
  const profession = referral.profession?.trim()
  const dated = referral.date ? `dated ${longDate(referral.date)}` : ""
  if (profession && name && dated) {
    return `A referral from ${voice.possessive} ${profession.toLowerCase()}, ${name}, ${dated}.`
  }
  if (name && dated) return `A referral from ${name}, ${dated}.`
  if (name) return `A referral from ${name}.`
  return null
}

function presentingParagraphs(
  source: BackgroundReportSource,
  voice: Voice,
  omitted: BackgroundReportOmission[]
): string[] {
  const { reason } = source.data
  const first = source.clientFirstName.trim() || "the client"
  const items: string[] = []
  const referred = reason.referredByMedicalProfessional

  if (referred === "yes" && reason.referrerConcerns.trim() && source.referral?.lastName) {
    const surname = [source.referral.title?.trim(), source.referral.lastName.trim()].filter(Boolean).join(" ")
    items.push(`${surname} referred ${first} with concerns about ${reason.referrerConcerns.trim()}.`)
  } else if (referred === "yes" && !reason.referrerConcerns.trim()) {
    omitted.push({
      id: "referrer-concerns",
      message: "Referrer's concerns not recorded",
      target: "reason",
    })
  } else if (referred === "not_asked") {
    omitted.push({ id: "referral", message: "Referral not asked", target: "reason" })
  } else if (referred == null) {
    omitted.push({ id: "referral", message: "Referral not recorded", target: "reason" })
  }

  if (reason.familyInvolved === "yes") {
    items.push(
      reason.familyInvolvement.trim()
        ? sentence(reason.familyInvolvement)
        : `Family were involved in ${first} attending.`
    )
  } else if (reason.familyInvolved === "not_asked") {
    omitted.push({ id: "family-involvement", message: "Family involvement not asked", target: "reason" })
  } else if (reason.familyInvolved == null) {
    omitted.push({ id: "family-involvement", message: "Family involvement not recorded", target: "reason" })
  }

  const yesStressors: string[] = []
  const noStressors: string[] = []
  let stressorAnswered = false
  for (const item of STRESSOR_ITEMS) {
    const answer = source.data.stressors[item.key]
    if (answer === "yes") {
      stressorAnswered = true
      yesStressors.push(item.label.toLowerCase())
    } else if (answer === "no") {
      stressorAnswered = true
      noStressors.push(item.label.toLowerCase())
    } else if (answer === "not_asked" && stressorAnswered) {
      omitted.push({ id: `stressor-${item.key}`, message: `${item.label} not asked`, target: "stressors" })
    }
  }
  if (!stressorAnswered) {
    omitted.push({ id: "stressors", message: "Current stressors not assessed", target: "stressors" })
  } else {
    const sentences: string[] = []
    if (yesStressors.length > 0) {
      sentences.push(`${voice.Subject} reported current difficulties with ${joinList(yesStressors, "and")}.`)
    }
    if (noStressors.length > 0) {
      sentences.push(`${voice.Subject} denied difficulties with ${joinList(noStressors, "and")}.`)
    }
    if (sentences.length > 0) items.push(sentences.join(" "))
    for (const item of STRESSOR_ITEMS) {
      if (source.data.stressors[item.key] === "not_asked") {
        const id = `stressor-${item.key}`
        if (!omitted.some((row) => row.id === id)) {
          omitted.push({ id, message: `${item.label} not asked`, target: "stressors" })
        }
      }
    }
  }

  if (source.data.stressors.mainReason.trim()) {
    items.push(
      `${first} described the main problem as: "${source.data.stressors.mainReason.trim()}".`
    )
  } else {
    omitted.push({
      id: "main-reason",
      message: "Client's own description of the problem not recorded",
      target: "stressors",
    })
  }

  const motivation: string[] = []
  if (reason.ownInitiative === "yes") motivation.push(`attended on ${voice.possessive} own initiative`)
  else if (reason.ownInitiative === "no") motivation.push(`did not attend on ${voice.possessive} own initiative`)
  else if (reason.ownInitiative === "not_asked") {
    omitted.push({ id: "own-initiative", message: "Own initiative not asked", target: "reason" })
  } else {
    omitted.push({ id: "own-initiative", message: "Own initiative not recorded", target: "reason" })
  }

  if (reason.attendedWillingly === "yes") motivation.push("willingly")
  else if (reason.attendedWillingly === "somewhat") motivation.push("somewhat willingly")
  else if (reason.attendedWillingly === "no") motivation.push("unwillingly")
  else if (reason.attendedWillingly === "not_asked") {
    omitted.push({ id: "willingness", message: "Willingness to attend not asked", target: "reason" })
  } else {
    omitted.push({ id: "willingness", message: "Willingness to attend not recorded", target: "reason" })
  }

  if (motivation.length > 0 || reason.clientMotivation.trim()) {
    const lead = motivation.length > 0 ? `${voice.Subject} ${joinList(motivation, "and")}.` : ""
    const detail = reason.clientMotivation.trim() ? sentence(reason.clientMotivation) : ""
    items.push([lead, detail].filter(Boolean).join(" "))
  }
  if (!reason.clientMotivation.trim()) {
    omitted.push({ id: "motivation", message: "Client's motivation not recorded", target: "reason" })
  }

  items.push(`[How ${first} presented — practitioner to write.]`)
  return items
}

function demographicsParagraphs(
  source: BackgroundReportSource,
  voice: Voice,
  omitted: BackgroundReportOmission[]
): string[] {
  const { identity, livingSituation, education, occupation } = source.data.demographics
  const items: string[] = []
  const basics: string[] = []
  const age = source.dateOfBirth ? agePhrase(source.dateOfBirth, source.reportDate) : null
  if (age) basics.push(`${voice.Subject} is ${age} years old`)
  else omitted.push({ id: "age", message: "Age not recorded", target: "identity" })

  const gender = identity.genderIdentity.trim()
  const sex = identity.sex.trim()
  if (gender) basics.push(lowerFirst(gender))
  else if (sex) basics.push(lowerFirst(sex))
  else omitted.push({ id: "sex", message: "Sex or gender not recorded", target: "identity" })

  let basicsSentence = ""
  if (basics.length > 0) basicsSentence = `${joinList(basics, "and")}.`
  const pronouns = identity.pronouns.trim()
  if (pronouns) {
    basicsSentence = `${basicsSentence} ${voice.Subject} uses ${pronouns} pronouns.`.trim()
  } else {
    omitted.push({ id: "pronouns", message: "Pronouns not recorded", target: "identity" })
  }
  const language = identity.primaryLanguage.trim()
  const religion = identity.religion.trim()
  if (language && religion) {
    basicsSentence += ` ${voice.Possessive} primary language is ${language} and ${voice.possessive} religion is ${religion}.`
  } else if (language) {
    basicsSentence += ` ${voice.Possessive} primary language is ${language}.`
    omitted.push({ id: "religion", message: "Religion not recorded", target: "identity" })
  } else if (religion) {
    basicsSentence += ` ${voice.Possessive} religion is ${religion}.`
    omitted.push({ id: "language", message: "Language not recorded", target: "identity" })
  } else {
    omitted.push({ id: "language", message: "Language not recorded", target: "identity" })
    omitted.push({ id: "religion", message: "Religion not recorded", target: "identity" })
  }
  if (identity.raceEthnicity.trim()) {
    basicsSentence += ` ${voice.Possessive} cultural background is ${identity.raceEthnicity.trim()}.`
  }
  if (basicsSentence.trim()) items.push(basicsSentence.trim())

  const status = source.data.relationshipStatus.relationshipStatus
  const partnerBits: string[] = []
  const currentPartner = source.data.relationships.find((row) => row.relationshipToClient === "current_partner")
  const yearsTogether = currentPartner?.lengthOfRelationship.trim() ?? ""
  if (status) {
    const label = (
      status === "other"
        ? source.data.relationshipStatus.relationshipStatusOther.trim() || "in another relationship"
        : CLIENT_RELATIONSHIP_STATUS_LABELS[status]
    ).toLowerCase()
    const length = yearsTogether ? ` of ${yearsTogether.replace(/^of\s+/i, "")}` : ""
    if (status === "single" || status === "separated" || status === "divorced" || status === "widowed") {
      partnerBits.push(`${voice.Subject} is ${label}${length}.`)
    } else if (status === "defacto") {
      partnerBits.push(`${voice.Subject} is in a de facto relationship${length}.`)
    } else if (status === "married" || status === "engaged") {
      partnerBits.push(`${voice.Subject} is ${label}${length}.`)
    } else {
      partnerBits.push(`${voice.Subject} is ${label}${length}.`)
    }
  } else {
    omitted.push({ id: "relationship-status", message: "Relationship status not recorded", target: "relationships" })
  }
  if (status && PARTNER_EXPECTED.includes(status) && !yearsTogether) {
    omitted.push({ id: "years-together", message: "Years together not recorded", target: "relationships" })
  }

  const prior = source.data.relationships.filter((row) => row.relationshipToClient === "prior_partner")
  if (prior.length > 0) {
    const years = prior.map((row) => row.lengthOfRelationship.trim()).filter(Boolean)
    const count = countPhrase(prior.length, "previous significant relationship", "previous significant relationships")
    partnerBits.push(
      years.length === prior.length
        ? `${voice.Subject} has had ${count}, of ${joinList(years, "and")}.`
        : `${voice.Subject} has had ${count}.`
    )
    if (years.length !== prior.length) {
      omitted.push({
        id: "prior-years",
        message: "Years of previous relationships not recorded",
        target: "relationships",
      })
    }
  }

  const children = people(source.data.relationships, CHILD_ROLES)
  if (children.length > 0) {
    const ages = agedList(children, source.reportDate)
    const noun = countPhrase(children.length, "child", "children")
    partnerBits.push(
      ages.length > 0
        ? `${voice.Subject} has ${noun}, aged ${joinList(ages, "and")}.`
        : `${voice.Subject} has ${noun}.`
    )
    if (ages.length !== children.length) {
      omitted.push({ id: "child-ages", message: "Children's ages not recorded", target: "relationships" })
    }
  }
  if (partnerBits.length > 0) items.push(partnerBits.join(" "))

  const origin: string[] = []
  const parents = people(source.data.relationships, PARENT_ROLES)
  const parentIds = new Set(parents.map((row) => row.relationshipRecordId))
  const parentPartnership = source.data.partnerships.find(
    (row) => parentIds.has(row.partnerAId) && parentIds.has(row.partnerBId) && row.relationshipStatus
  )
  if (parentPartnership?.relationshipStatus) {
    origin.push(
      `${voice.Possessive} parents are ${PARTNERSHIP_STATUS_LABELS[parentPartnership.relationshipStatus].toLowerCase()}.`
    )
  } else if (parents.length >= 2) {
    omitted.push({
      id: "parents-relationship",
      message: "Parents' relationship not recorded",
      target: "relationships",
    })
  }
  let parentsHealthMissing = false
  for (const parent of parents) {
    const role = personRoleLabel(parent).toLowerCase()
    const deceased = parent.deceased || parent.healthStatus === "deceased"
    const age = parent.dateOfBirth ? agePhrase(parent.dateOfBirth, source.reportDate) : null
    const health =
      parent.healthStatus && parent.healthStatus !== "deceased"
        ? HEALTH_STATUS_LABELS[parent.healthStatus as HealthStatus].toLowerCase()
        : ""
    if (deceased) origin.push(`${voice.Possessive} ${role} is deceased.`)
    else if (age && health) origin.push(`${voice.Possessive} ${role} is ${age} and in ${health} health.`)
    else if (age) origin.push(`${voice.Possessive} ${role} is ${age}.`)
    else if (health) origin.push(`${voice.Possessive} ${role} is in ${health} health.`)
    if (!deceased && !health) parentsHealthMissing = true
  }
  if (parentsHealthMissing) {
    omitted.push({ id: "parents-health", message: "Parents' health not recorded", target: "relationships" })
  }

  const siblingGroups: { roles: RelationshipToClient[]; singular: string; plural: string }[] = [
    { roles: ["sibling_full"], singular: "sibling", plural: "siblings" },
    { roles: ["sibling_half"], singular: "half-sibling", plural: "half-siblings" },
    { roles: ["sibling_step"], singular: "step-sibling", plural: "step-siblings" },
  ]
  for (const group of siblingGroups) {
    const rows = people(source.data.relationships, group.roles)
    if (rows.length === 0) continue
    const ages = agedList(rows, source.reportDate)
    const noun = countPhrase(rows.length, group.singular, group.plural)
    origin.push(
      ages.length > 0
        ? `${voice.Subject} has ${noun}, aged ${joinList(ages, "and")}.`
        : `${voice.Subject} has ${noun}.`
    )
    if (ages.length !== rows.length) {
      omitted.push({
        id: `ages-${group.singular}`,
        message: `${group.plural.charAt(0).toUpperCase()}${group.plural.slice(1)}' ages not recorded`,
        target: "relationships",
      })
    }
  }
  if (origin.length > 0) items.push(origin.join(" "))

  const living: string[] = []
  if (livingSituation.livesWith) {
    const label =
      livingSituation.livesWith === "other"
        ? livingSituation.livesWithOther.trim() || "someone else"
        : LIVES_WITH_LABELS[livingSituation.livesWith]
    const who = lowerFirst(label.replace(/^With\s+/i, ""))
    living.push(who === "alone" ? `${voice.Subject} lives alone` : `${voice.Subject} lives with ${who}`)
  } else {
    omitted.push({ id: "lives-with", message: "Who they live with not recorded", target: "living" })
  }
  if (livingSituation.housingType.trim()) living.push(`in ${lowerFirst(livingSituation.housingType.trim())}`)
  else omitted.push({ id: "housing-type", message: "Housing type not recorded", target: "living" })
  if (livingSituation.housingStability === "Stable") living.push(`describes ${voice.possessive} housing as stable`)
  else if (livingSituation.housingStability === "Some concern") {
    living.push(`describes ${voice.possessive} housing with some concern`)
  } else if (livingSituation.housingStability === "Unstable") {
    living.push(`describes ${voice.possessive} housing as unstable`)
  } else {
    omitted.push({ id: "housing-stability", message: "Housing stability not recorded", target: "living" })
  }
  if (living.length > 0) items.push(`${sentence(living[0].endsWith(".") ? living[0] : joinList(living, "and"))}`)

  const work: string[] = []
  if (education.level.trim()) {
    const field = education.fieldOfStudy.trim()
    work.push(
      `${voice.Possessive} highest education is ${education.level.trim()}${field ? ` in ${field}` : ""}.`
    )
  } else {
    omitted.push({ id: "education", message: "Highest education not recorded", target: "occupation" })
  }
  if (education.currentlyStudying === true) {
    work.push(
      education.currentlyStudyingDetail.trim()
        ? `${voice.Subject} is currently studying ${education.currentlyStudyingDetail.trim()}.`
        : `${voice.Subject} is currently studying.`
    )
  } else if (education.currentlyStudying === false) {
    work.push(`${voice.Subject} is not currently studying.`)
  } else {
    omitted.push({ id: "studying", message: "Currently studying not recorded", target: "occupation" })
  }
  if (occupation.workStatus) {
    const statusLabel =
      occupation.workStatus === "other"
        ? occupation.workStatusOther.trim() || "in other work"
        : WORK_STATUS_LABELS[occupation.workStatus].toLowerCase()
    const role = occupation.role.trim()
    if (occupation.workStatus === "unemployed" || occupation.workStatus === "retired") {
      work.push(`${voice.Subject} is ${statusLabel}.`)
    } else if (role) {
      work.push(`${voice.Subject} works ${statusLabel} as ${role}.`)
    } else {
      work.push(`${voice.Subject} works ${statusLabel}.`)
    }
  } else {
    omitted.push({ id: "work", message: "Work status not recorded", target: "occupation" })
  }
  if (work.length > 0) items.push(work.join(" "))

  const health: string[] = []
  if (identity.disability === false) health.push(`${voice.Subject} reported no disability.`)
  else if (identity.disability === true) {
    health.push(
      identity.disabilityDetail.trim()
        ? `${voice.Subject} reported ${identity.disabilityDetail.trim()}.`
        : `${voice.Subject} reported a disability.`
    )
    if (!identity.disabilityDetail.trim()) {
      omitted.push({ id: "disability-detail", message: "Disability detail not recorded", target: "identity" })
    }
  } else {
    omitted.push({ id: "disability", message: "Disability not recorded", target: "identity" })
  }
  const taking = source.data.medication.currentlyTaking
  if (taking === "no") {
    health.push(`${voice.Subject} is not currently taking medication for emotional problems.`)
  } else if (taking === "yes") {
    const supervisor = source.data.medication.supervisedBy.trim()
    health.push(
      supervisor
        ? `${voice.Subject} is currently taking medication for emotional problems, supervised by ${supervisor}.`
        : `${voice.Subject} is currently taking medication for emotional problems.`
    )
    if (!supervisor) {
      omitted.push({ id: "supervisor", message: "Medication supervisor not recorded", target: "medication" })
    }
  } else if (taking === "not_asked") {
    omitted.push({ id: "medication", message: "Current medication not asked", target: "medication" })
  } else {
    omitted.push({ id: "medication", message: "Current medication not recorded", target: "medication" })
  }
  if (health.length > 0) items.push(health.join(" "))

  return items
}

function purposeParagraphs(source: BackgroundReportSource, omitted: BackgroundReportOmission[]): string[] {
  const name = source.practitionerName.trim()
  const profession = source.profession?.trim() ?? ""
  const year = source.yearRegistered?.trim() ?? ""
  let intro = name ? `I am ${name}` : "I prepared this report"
  if (profession) intro += `, a registered ${profession}`
  if (year) intro += profession ? ` since ${year}` : `, registered since ${year}`
  intro += "."
  if (!profession) {
    omitted.push({ id: "profession", message: "Profession not recorded", target: "practitioner" })
  }
  if (!year) {
    omitted.push({ id: "year-registered", message: "Year registered not recorded", target: "practitioner" })
  }
  const full = [source.clientFirstName.trim(), source.clientLastName.trim()].filter(Boolean).join(" ")
  const first = source.clientFirstName.trim() || "the client"
  return [
    intro,
    `This report summarises my background assessment of ${full || first}.`,
    `The report addresses ${first}'s presenting problem, demographics, relevant history and risk.`,
  ]
}

export function generateBackgroundReport(source: BackgroundReportSource): BackgroundReportDraft {
  const pronouns = source.data.demographics.identity.pronouns.trim()
  const voice = voiceFor(pronouns, source.clientFirstName)
  const omitted: BackgroundReportOmission[] = []
  const first = source.clientFirstName.trim()
  const last = source.clientLastName.trim()
  const dob = dobLabel(source.dateOfBirth)
  const title = dob
    ? `BACKGROUND REPORT for ${first} ${last} (DOB: ${dob})`
    : `BACKGROUND REPORT for ${first} ${last}`
  if (!dob) omitted.push({ id: "dob", message: "Date of birth not recorded", target: "identity" })

  const sections: { title: string; items: string[] }[] = [
    { title: "Purpose and Scope", items: purposeParagraphs(source, omitted) },
    {
      title: "Sources",
      items: [
        sageSentence(source.sageModules),
        questionnaireSentence(source.questionnaires, source.selfReportDate),
        interviewSentence(source),
        collateralSentence(source, voice),
      ].filter((item): item is string => Boolean(item)),
    },
    { title: "Presenting Problem", items: presentingParagraphs(source, voice, omitted) },
    { title: "Demographics", items: demographicsParagraphs(source, voice, omitted) },
    {
      title: "Relevant History",
      items: [
        ...historyParagraphs(source, voice, omitted, false),
        ...historyParagraphs(source, voice, omitted, true),
        "[Alcohol and other drugs — to be added (ASSIST).]",
      ],
    },
    { title: "Risk Assessment", items: ["[Risk assessment — to be added (LRAMP).]"] },
    { title: "Summary", items: ["[Summary — practitioner to write.]"] },
  ]

  const content: LetterBodyNode[] = [
    paragraph(longDate(source.reportDate)),
    paragraph(title, true),
  ]
  for (const section of sections) {
    if (section.items.length === 0) continue
    content.push(numberedHeading(section.title))
    content.push(orderedList(section.items))
  }
  content.push(paragraph("Yours sincerely,"))

  return { document: { type: "doc", content }, omitted }
}
