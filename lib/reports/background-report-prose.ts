import { assessAge, clientAgeAtStart, compareEventsChronologically } from "@/lib/client-background/age"
import { resolvedAbout } from "@/lib/client-background/interview-history"
import { treatmentsForCondition } from "@/lib/client-background/history-links"
import { parsePartialDate, precisionForPartialDate } from "@/lib/client-background/partial-date"
import { professionalSummary, type ProfessionalOption } from "@/lib/client-background/professionals"
import { halfSiblingSide, stepParentLinks } from "@/lib/client-background/tree"
import {
  ADMISSION_TYPE_LABELS,
  CLIENT_RELATIONSHIP_STATUS_LABELS,
  type AdmissionType,
  type ClientRelationshipStatus,
  type EventRecord,
  type PartnershipRecord,
  type RelationshipRecord,
  type StartPrecision,
} from "@/lib/client-background/types"

/**
 * Lower-cases prose one letter-run at a time.
 * A run of two or more letters that is entirely capitals stays as typed
 * (digits and punctuation such as / - . are left in place and ignored).
 * A mixed-case run with a capital after its first letter stays as typed.
 * Every other run is lower-cased.
 */
export function lowerKeepingTypedCase(value: string): string {
  return value.replace(/[A-Za-z]+/g, (word) => {
    if (word.length >= 2 && word === word.toUpperCase()) return word
    if (/[A-Z]/.test(word.slice(1))) return word
    return word.toLowerCase()
  })
}

/** Lower-case only the first word, and only when the capitals helper allows it. */
export function lowerLeadingWord(value: string): string {
  const trimmed = value.trim()
  const match = /^([A-Za-z]+)([\s\S]*)$/.exec(trimmed)
  if (!match) return trimmed
  return lowerKeepingTypedCase(match[1]) + match[2]
}

/** "GP" and "General practitioner" are written as GP. Other professions keep typed capitals. */
export function reportProfession(value: string | null | undefined): string {
  const text = (value ?? "").trim()
  if (!text) return ""
  if (/^general practitioners?$/i.test(text) || /^g\.?p\.?$/i.test(text)) return "GP"
  return lowerKeepingTypedCase(text)
}

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]

export function agree(voice: ReportVoice, singular: string, pluralForm: string): string {
  return voice.kind === "they" ? pluralForm : singular
}

export function countWord(count: number): string {
  if (count >= 0 && count <= 9) return COUNT_WORDS[count] ?? String(count)
  return String(count)
}

export type ReportVoice = {
  kind: "he" | "she" | "they" | "name"
  subject: string
  Subject: string
  possessive: string
  Possessive: string
  object: string
}

type DatedEvent = Pick<
  EventRecord,
  | "eventRecordId"
  | "eventType"
  | "title"
  | "startPrecision"
  | "startValue"
  | "endPrecision"
  | "endValue"
  | "endOngoing"
  | "resolvedOrOngoing"
  | "displayOrder"
  | "selfHarmType"
  | "admissionType"
  | "admissionLength"
  | "conditionEventId"
  | "attribution"
  | "prescriberName"
  | "prescriberProfessionalId"
  | "relationshipRecordId"
  | "familyRelation"
>

export function proseDate(value: string): string {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
    if (!match) return trimmed
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    return date.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
  }
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    const match = /^(\d{4})-(\d{2})/.exec(trimmed)
    if (!match) return trimmed
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1)
    return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" })
  }
  return trimmed
}

export function yearOf(precision: string, value: string): string {
  if (precision === "age" || !precision) return ""
  return /^(\d{4})/.exec(value.trim())?.[1] ?? ""
}

/** A year-only date is the client's age at 1 July of that year. */
export function ageAtRecordedDate(
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

export function ageOn(dateOfBirth: string | null, when: string): number | null {
  if (!dateOfBirth || !when.trim()) return null
  const precision = precisionForPartialDate(parsePartialDate(when))
  if (!precision) return null
  return ageAtRecordedDate(dateOfBirth, precision, when.trim())
}

export function personAge(dateOfBirth: string, asOf: string): number | null {
  const reading = assessAge(parsePartialDate(dateOfBirth), parsePartialDate(asOf), "person")
  if (reading.kind === "exact" || reading.kind === "approximate") return reading.years
  if (reading.kind === "ambiguous") return reading.high
  return null
}

function hasBareComma(item: string): boolean {
  let depth = 0
  for (const char of item) {
    if (char === "(") depth += 1
    else if (char === ")") depth = Math.max(0, depth - 1)
    else if (char === "," && depth === 0) return true
  }
  return false
}

/** "a, b and c". Items with a comma outside brackets are separated with semicolons. */
export function joinProse(items: string[]): string {
  const clean = items.map((item) => item.trim()).filter(Boolean)
  if (clean.length === 0) return ""
  if (clean.length === 1) return clean[0]
  const bare = clean.some(hasBareComma)
  if (clean.length === 2) {
    const outside = clean[0].replace(/\([^)]*\)/g, "")
    if (bare || /\band\b/.test(outside)) return `${clean[0]}, and ${clean[1]}`
    return `${clean[0]} and ${clean[1]}`
  }
  if (bare) return `${clean.slice(0, -1).join("; ")}; and ${clean[clean.length - 1]}`
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`
}

function joinAnd(items: string[]): string {
  return joinProse(items)
}

function deceased(person: RelationshipRecord): boolean {
  return person.deceased || person.healthStatus === "deceased"
}

function sortByStart(events: DatedEvent[], dateOfBirth: string | null): DatedEvent[] {
  return [...events].sort((a, b) => compareEventsChronologically(a, b, dateOfBirth))
}

function isOngoing(event: DatedEvent): boolean {
  return event.endOngoing || event.resolvedOrOngoing === "ongoing"
}

/** Point, span, or ongoing wording. Empty when the entry has no usable date. */
export function eventWhenPhrase(event: DatedEvent, dateOfBirth: string | null, ongoingStyle: "starting" | "since"): string {
  const startAge = ageAtRecordedDate(dateOfBirth, event.startPrecision, event.startValue)
  const startYear = yearOf(event.startPrecision, event.startValue)
  if (startAge == null) return ""
  if (isOngoing(event)) {
    const year = startYear ? ` (${startYear})` : ""
    return `${ongoingStyle} at age ${startAge}${year}`.replace(/^since at /, "since ")
  }
  const endAge = ageAtRecordedDate(dateOfBirth, event.endPrecision, event.endValue)
  const endYear = yearOf(event.endPrecision, event.endValue)
  if (endAge != null && endAge !== startAge) {
    const years = startYear && endYear ? ` (${startYear}–${endYear})` : ""
    return `from age ${startAge} to ${endAge}${years}`
  }
  const year = startYear ? ` (${startYear})` : ""
  return `at age ${startAge}${year}`
}

function titled(event: DatedEvent, fallback: string): string {
  const title = event.title.trim()
  return title ? lowerKeepingTypedCase(title) : fallback
}

function colonDetail(event: DatedEvent, dateOfBirth: string | null): string {
  const when = eventWhenPhrase(event, dateOfBirth, "starting")
  const title = event.title.trim() ? lowerLeadingWord(event.title) : ""
  return [title, when].filter(Boolean).join(" ")
}

function colonSentence(
  events: DatedEvent[],
  name: string,
  dateOfBirth: string | null,
  singular: string,
  plural: string
): string {
  const bits = sortByStart(events, dateOfBirth).map((event) => colonDetail(event, dateOfBirth))
  const head = events.length === 1 ? singular : plural
  return `${name} reported ${head}: ${joinAnd(bits)}.`
}

/** "Tom reported an illness or injury: broken leg at age 12 (1982)." Untitled entries keep the older grouping. */
export function illnessInjurySentence(events: DatedEvent[], name: string, dateOfBirth: string | null): string {
  const sorted = sortByStart(events, dateOfBirth)
  if (sorted.some((event) => !event.title.trim())) {
    const parts = sorted.map((event) => {
      const when = eventWhenPhrase(event, dateOfBirth, "starting")
      return [titled(event, "an illness or injury"), when].filter(Boolean).join(" ")
    })
    return `${name} reported ${joinAnd(parts)}.`
  }
  return colonSentence(sorted, name, dateOfBirth, "an illness or injury", "illnesses or injuries")
}

/** "Ben01 reported a history of depression from age 30 to 32 (2005–2007), and again starting at age 50 (2025)." */
export function emotionalProblemsSentence(events: DatedEvent[], name: string, dateOfBirth: string | null): string {
  const sorted = sortByStart(events, dateOfBirth)
  const bits: string[] = []
  sorted.forEach((event, index) => {
    const when = eventWhenPhrase(event, dateOfBirth, "starting")
    const title = titled(event, "emotional problems")
    if (index === 0) {
      bits.push(["a history of " + title, when].filter(Boolean).join(" "))
      return
    }
    const previous = titled(sorted[index - 1], "emotional problems")
    bits.push(previous === title ? ["again", when].filter(Boolean).join(" ") : ["a history of " + title, when].filter(Boolean).join(" "))
  })
  const phrase = bits.length > 1 ? `${bits[0]}, and ${bits.slice(1).join(", and ")}` : bits[0]
  return `${name} reported ${phrase}.`
}

function admissionPlace(event: DatedEvent): string {
  if (event.admissionType === "psychiatric_inpatient") return "a psychiatric unit"
  if (event.admissionType === "residential_rehab") return "residential rehab"
  if (event.admissionType === "medical") return "hospital"
  if (event.admissionType === "emergency_department") return "an emergency department"
  const label = event.admissionType ? ADMISSION_TYPE_LABELS[event.admissionType as AdmissionType] : ""
  return label ? lowerKeepingTypedCase(label) : "hospital"
}

/** One linked treatment, without the subject. */
export function linkedTreatmentClause(event: DatedEvent, dateOfBirth: string | null): string {
  const when = eventWhenPhrase(event, dateOfBirth, event.eventType === "medication" ? "since" : "starting")
  const length = event.admissionLength.trim()
  if (event.eventType === "psychiatric_admission") {
    if (event.admissionType === "residential_rehab") {
      return ["attended residential rehab", when].filter(Boolean).join(" ")
    }
    return ["was admitted to " + admissionPlace(event), when, length ? `for ${lowerKeepingTypedCase(length)}` : ""].filter(Boolean).join(" ")
  }
  if (event.eventType === "previous_therapy") {
    const who = titled(event, "a therapist")
    const person = /^(a|an)\s/.test(who) ? who : `a ${who}`
    return ["saw " + person.replace(/^saw a a /, "saw a "), when].filter(Boolean).join(" ").replace(/^saw a a /, "saw a ")
  }
  const name = titled(event, "medication")
  if (isOngoing(event)) return ["has been treated with " + name, when].filter(Boolean).join(" ")
  return ["was treated with " + name, when].filter(Boolean).join(" ")
}

/** "He was admitted to a psychiatric unit at age 31 (2006) for two weeks, saw a psychologist from age 31 to 32, and has been treated with sertraline since age 50." */
export function linkedTreatmentsSentence(events: DatedEvent[], voice: ReportVoice, dateOfBirth: string | null): string {
  const clauses = sortByStart(events, dateOfBirth)
    .map((event) => linkedTreatmentClause(event, dateOfBirth))
    .filter(Boolean)
    .map((clause) => (voice.kind === "they" ? clause.replace(/\bwas\b/, "were").replace(/\bhas\b/, "have") : clause))
  if (clauses.length === 0) return ""
  const joined =
    clauses.length === 1
      ? clauses[0]
      : `${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}`
  return `${voice.Subject} ${joined}.`
}

/** "Ben01 reported alcohol use from age 18 to 30, and attended residential rehab at age 30 (2005)." */
export function substanceUseSentence(
  events: DatedEvent[],
  treatments: DatedEvent[],
  name: string,
  dateOfBirth: string | null
): string {
  const uses = sortByStart(events, dateOfBirth).map((event) => {
    const raw = event.title.trim() ? lowerKeepingTypedCase(event.title.trim()) : "substance use"
    const label = /\buse\b/i.test(raw) ? raw : `${raw} use`
    const when = eventWhenPhrase(event, dateOfBirth, "starting")
    return [label, when].filter(Boolean).join(" ")
  })
  const care = sortByStart(treatments, dateOfBirth).map((event) => linkedTreatmentClause(event, dateOfBirth))
  const body = care.length > 0 ? `${joinAnd(uses)}, and ${joinAnd(care)}` : joinAnd(uses)
  return `${name} reported ${body}.`
}

function withIndefinite(title: string): string {
  const lower = lowerKeepingTypedCase(title.trim())
  if (!lower) return ""
  if (/^(a|an|the)\b/i.test(lower)) return lower
  const article = /^[aeiou]/i.test(lower) ? "an" : "a"
  return `${article} ${lower}`
}

/**
 * A titled entry is "self-harm: cutting from age 14 to 16". Untitled entries
 * share the heading once, as before. The self-harm method is never printed.
 */
export function selfHarmSentence(events: DatedEvent[], name: string, dateOfBirth: string | null): string {
  const sorted = sortByStart(events, dateOfBirth)
  if (sorted.length > 0 && sorted.every((event) => event.title.trim())) {
    return colonSentence(sorted, name, dateOfBirth, "self-harm", "self-harm")
  }
  const untitled = sorted.filter((event) => !event.title.trim())
  const titled = sorted.filter((event) => event.title.trim())
  const parts: { event: DatedEvent; text: string }[] = []
  if (untitled.length > 0) {
    const whens = untitled
      .map((event) => eventWhenPhrase(event, dateOfBirth, "starting"))
      .filter(Boolean)
    const whenText = whens
      .map((when, index) => (index === 0 ? when : when.replace(/^at /, "")))
      .join(" and ")
    parts.push({
      event: untitled[0],
      text: ["self-harm", whenText].filter(Boolean).join(" "),
    })
  }
  for (const event of titled) {
    const when = eventWhenPhrase(event, dateOfBirth, "starting")
    parts.push({
      event,
      text: [withIndefinite(event.title), when].filter(Boolean).join(" "),
    })
  }
  parts.sort((a, b) => compareEventsChronologically(a.event, b.event, dateOfBirth))
  return `${name} reported ${joinProse(parts.map((part) => part.text))}.`
}

/** "Tom reported a traumatic event: serious car accident at age 19 (1989)." Untitled entries keep the older grouping. */
export function traumaticEventsSentence(events: DatedEvent[], name: string, dateOfBirth: string | null): string {
  const sorted = sortByStart(events, dateOfBirth)
  if (sorted.some((event) => !event.title.trim())) {
    const parts = sorted.map((event) => {
      const when = eventWhenPhrase(event, dateOfBirth, "starting")
      return ["experiencing " + titled(event, "a traumatic event"), when].filter(Boolean).join(" ")
    })
    return `${name} reported ${joinAnd(parts)}.`
  }
  return colonSentence(sorted, name, dateOfBirth, "a traumatic event", "traumatic events")
}

/** "Tom reported a significant event: moved interstate at age 15 (1985)." Untitled entries keep the older grouping. */
export function otherSignificantEventsSentence(events: DatedEvent[], name: string, dateOfBirth: string | null): string {
  const sorted = sortByStart(events, dateOfBirth)
  if (sorted.some((event) => !event.title.trim())) {
    const parts = sorted.map((event) => {
      const when = eventWhenPhrase(event, dateOfBirth, "starting")
      return [titled(event, "another significant event"), when].filter(Boolean).join(" ")
    })
    return `${name} reported ${joinAnd(parts)}.`
  }
  return colonSentence(sorted, name, dateOfBirth, "a significant event", "significant events")
}

/** "Ben01 also reported taking temazepam from age 31 to 32." */
export function unlinkedTreatmentSentence(events: DatedEvent[], name: string, dateOfBirth: string | null): string {
  const parts = sortByStart(events, dateOfBirth).map((event) => {
    const when = eventWhenPhrase(event, dateOfBirth, "since")
    if (event.eventType === "medication") return ["taking " + titled(event, "medication"), when].filter(Boolean).join(" ")
    if (event.eventType === "previous_therapy") return ["therapy" + (event.title.trim() ? ` with ${titled(event, "")}` : ""), when].filter(Boolean).join(" ")
    return [linkedTreatmentClause(event, dateOfBirth)].filter(Boolean).join(" ")
  })
  return `${name} also reported ${joinAnd(parts)}.`
}

function sexWord(sex: string): "female" | "male" | "" {
  const value = sex.trim().toLowerCase()
  if (value === "female") return "female"
  if (value === "male") return "male"
  return ""
}

function partnerBySex(sex: string, married: boolean, voice: ReportVoice): string {
  const value = sexWord(sex)
  if (married) {
    if (value === "female") return `${voice.possessive} wife`
    if (value === "male") return `${voice.possessive} husband`
    return `${voice.possessive} partner`
  }
  if (value === "female") return "a woman"
  if (value === "male") return "a man"
  return "a partner"
}

function childAges(children: RelationshipRecord[], asOf: string): string {
  const ages = children
    .map((child) => (child.dateOfBirth ? personAge(child.dateOfBirth, asOf) : null))
    .filter((age): age is number => age != null)
    .sort((a, b) => b - a)
    .map(String)
  if (ages.length === 0) return ""
  return `aged ${joinAnd(ages)}`
}

function childCountPhrase(children: RelationshipRecord[], asOf: string): string {
  const count = countWord(children.length)
  const noun = children.length === 1 ? "child" : "children"
  const ages = childAges(children, asOf)
  return ages ? `${count} ${noun}, ${ages}` : `${count} ${noun}`
}

function childrenOf(partnerId: string, people: RelationshipRecord[], kind: "child_biological" | "child_step"): RelationshipRecord[] {
  return people.filter((person) => person.relationshipToClient === kind && person.linkedPartnerRecordId === partnerId)
}

function relationshipRange(person: RelationshipRecord): string {
  const start = person.startedOn.trim() ? proseDate(person.startedOn) : ""
  const end = person.endedOn.trim() ? proseDate(person.endedOn) : ""
  if (start && end) return `from ${start} to ${end}`
  if (start) return `since ${start}`
  if (end) return `until ${end}`
  return ""
}

function howEnded(person: RelationshipRecord): string {
  return lowerKeepingTypedCase(person.relationshipStatus.trim())
}

/** Current relationship, then previous ones from most recent to oldest, then children with no partner. */
export function relationshipsParagraph(
  name: string,
  voice: ReportVoice,
  status: ClientRelationshipStatus | "",
  people: RelationshipRecord[],
  asOf: string
): string | null {
  const current = people.find((person) => person.relationshipToClient === "current_partner")
  const prior = people
    .filter((person) => person.relationshipToClient === "prior_partner")
    .sort((a, b) => (b.endedOn || b.startedOn).localeCompare(a.endedOn || a.startedOn))
  const sentences: string[] = []
  const statusLabel = status ? lowerKeepingTypedCase(CLIENT_RELATIONSHIP_STATUS_LABELS[status]) : ""

  if (current && status) {
    const married = status === "married"
    const partner = partnerBySex(current.sex, married, voice)
    const range = relationshipRange(current)
    const kind =
      status === "married"
        ? "married"
        : status === "defacto"
          ? "in a de facto relationship"
          : status === "engaged"
            ? "engaged"
            : status === "dating"
              ? "dating"
              : status === "in_relationship_not_living_together"
                ? "in a relationship"
                : statusLabel
    const withPartner =
      married || status === "engaged" ? `to ${partner}` : status === "dating" ? partner : `with ${partner}`
    sentences.push(`${name} has been ${kind} ${withPartner}${range ? ` ${range}` : ""}.`.replace("  ", " "))
    const own = childrenOf(current.relationshipRecordId, people, "child_biological")
    const step = childrenOf(current.relationshipRecordId, people, "child_step")
    const childBits: string[] = []
    if (own.length > 0) childBits.push(`They have ${childCountPhrase(own, asOf)}`)
    if (step.length > 0) {
      const who =
        married && sexWord(current.sex) === "female"
          ? "wife"
          : married && sexWord(current.sex) === "male"
            ? "husband"
            : "partner"
      const ages = childAges(step, asOf)
      childBits.push(
        `${voice.possessive} ${who} has ${countWord(step.length)} ${step.length === 1 ? "child" : "children"} from a previous relationship${ages ? `, ${ages}` : ""}`
      )
    }
    if (own.length === 0 && step.length === 0) sentences[sentences.length - 1] = sentences[sentences.length - 1].replace(/\.$/, ", with no children.")
    else if (childBits.length > 0) {
      const joined = childBits.length === 1 ? childBits[0] : `${childBits.slice(0, -1).join(", ")}, and ${childBits[childBits.length - 1]}`
      sentences.push(`${joined}.`)
    }
  } else if (status === "single" || status === "separated" || status === "divorced" || status === "widowed") {
    sentences.push(`${name} is currently ${statusLabel}.`)
  }

  for (const person of prior) {
    const type = person.partnerType || ""
    const married = type === "married"
    const partner = partnerBySex(person.sex, false, voice)
    const range = relationshipRange(person).replace(/^since /, "from ")
    const ended = howEnded(person)
    let line = ""
    if (married) {
      line = `${voice.Subject} ${agree(voice, "was", "were")} married to ${partner}${range ? ` ${range}` : ""}`
      line += ended ? `, and the marriage ended in ${ended}` : ""
    } else {
      const kind =
        type === "defacto"
          ? "a de facto relationship"
          : type === "engaged"
            ? "an engagement"
            : type === "dating"
              ? "a dating relationship"
              : "a relationship"
      line = `${voice.Subject} ${agree(voice, "was", "were")} previously in ${kind} with ${partner}${range ? ` ${range}` : ""}`
      if (ended) line += `, which ended in ${ended}`
    }
    const own = childrenOf(person.relationshipRecordId, people, "child_biological")
    const step = childrenOf(person.relationshipRecordId, people, "child_step")
    if (own.length === 0 && step.length === 0) line += ", with no children"
    sentences.push(`${line}.`)
    if (own.length > 0 || step.length > 0) {
      const bits: string[] = []
      if (own.length > 0) bits.push(`They have ${childCountPhrase(own, asOf)}`)
      if (step.length > 0) bits.push(`${voice.Possessive} partner has ${childCountPhrase(step, asOf)} from a previous relationship`)
      sentences.push(`${joinAnd(bits)}.`)
    }
  }

  const specials = people.filter(
    (person) => person.relationshipToClient === "child_biological" && !person.linkedPartnerRecordId && person.otherParentKind
  )
  if (specials.length > 0) {
    const groups = [
      { kind: "donor_conception", text: "by donor conception" },
      { kind: "adopted_sole", text: "adopted as a sole parent" },
      { kind: "other", text: "" },
    ] as const
    for (const group of groups) {
      const rows = specials.filter((person) => person.otherParentKind === group.kind)
      if (rows.length === 0) continue
      if (group.kind === "other") {
        const detail = rows.map((person) => person.otherParentDetail.trim()).filter(Boolean).join("; ")
        sentences.push(
          `${voice.Subject} ${agree(voice, "has", "have")} ${childCountPhrase(rows, asOf)}${detail ? `, whose other parent is ${detail}` : ""}.`
        )
      } else {
        const ages = childAges(rows, asOf)
        const noun = `${countWord(rows.length)} ${rows.length === 1 ? "child" : "children"}`
        const how = group.kind === "adopted_sole" ? `, ${group.text}` : ` ${group.text}`
        sentences.push(
          `${voice.Subject} ${agree(voice, "has", "have")} ${noun}${how}${ages ? `, ${ages}` : ""}.`
        )
      }
    }
  }

  return sentences.length > 0 ? sentences.join(" ") : null
}

function parentWord(person: RelationshipRecord, adoptive: boolean): string {
  const sex = sexWord(person.sex)
  const role =
    person.relationshipToClient === "mother" || sex === "female"
      ? "mother"
      : person.relationshipToClient === "father" || sex === "male"
        ? "father"
        : "parent"
  return adoptive ? `adoptive ${role}` : role
}

function parentSentence(
  person: RelationshipRecord,
  voice: ReportVoice,
  name: string,
  dateOfBirth: string | null,
  asOf: string,
  birth: boolean
): string | null {
  const knownRole =
    person.parentType === "adoptive"
      ? parentWord(person, true)
      : birth
        ? `birth ${parentWord(person, false)}`
        : parentWord(person, false)
  if (person.notKnown) return `${voice.Possessive} ${knownRole} is not known.`
  if (deceased(person)) {
    const year = yearOf(precisionForPartialDate(parsePartialDate(person.dateOfDeath)) ?? "", person.dateOfDeath)
    const age = person.dateOfDeath ? ageOn(dateOfBirth, person.dateOfDeath) : null
    if (year && age != null) return `${voice.Possessive} ${knownRole} died in ${year}, when ${name} was ${age}.`
    if (age != null) return `${voice.Possessive} ${knownRole} died when ${name} was ${age}.`
    return `${voice.Possessive} ${knownRole} is deceased.`
  }
  if (person.dateOfBirth) {
    const age = personAge(person.dateOfBirth, asOf)
    if (age != null) return `${voice.Possessive} ${knownRole} is ${age}.`
  }
  return null
}

function siblingSex(person: RelationshipRecord): string {
  const sex = sexWord(person.sex)
  if (sex === "female") return "sister"
  if (sex === "male") return "brother"
  return "sibling"
}

/** Parents, caregivers and siblings, adoptive family first when the client was adopted. */
export function familyOriginsParagraph(
  name: string,
  voice: ReportVoice,
  dateOfBirth: string | null,
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[],
  asOf: string
): string | null {
  const parents = people.filter((person) => ["mother", "father", "parent"].includes(person.relationshipToClient))
  const adoptive = parents.filter((person) => person.parentType === "adoptive")
  const birth = parents.filter((person) => person.parentType !== "adoptive")
  const both = adoptive.length > 0 && birth.length > 0
  const sentences: string[] = []

  const adoptedOn = adoptive.map((person) => person.adoptedOn.trim()).find(Boolean) ?? ""
  if (adoptedOn) {
    const age = ageOn(dateOfBirth, adoptedOn)
    const when = proseDate(adoptedOn)
    sentences.push(`${name} was adopted in ${when}${age != null ? `, at the age of ${age}` : ""}.`)
  }

  const describeGroup = (group: RelationshipRecord[], asBirth: boolean) => {
    for (const person of group) {
      const line = parentSentence(person, voice, name, dateOfBirth, asOf, both && asBirth)
      if (line) sentences.push(line)
    }
  }
  if (both) {
    describeGroup(adoptive, false)
    describeParentsBonds(adoptive, partnerships, voice, dateOfBirth, sentences, true)
    describeGroup(birth, true)
    describeParentsBonds(birth, partnerships, voice, dateOfBirth, sentences, true)
  } else {
    describeGroup(parents, false)
    describeParentsBonds(parents, partnerships, voice, dateOfBirth, sentences, false)
  }

  for (const link of stepParentLinks(people, partnerships)) {
    const partnership = partnerships.find((item) => item.partnershipRecordId === link.partnershipRecordId)
    const age = partnership?.started.trim() ? ageOn(dateOfBirth, partnership.started) : null
    const married = partnership?.relationshipStatus === "married"
    const verb = married ? "remarried" : "re-partnered"
    const role = parentWord(link.parent, link.parent.parentType === "adoptive")
    sentences.push(
      `${voice.Possessive} ${role} ${verb}${age != null ? ` when ${voice.subject} ${agree(voice, "was", "were")} ${age}` : ""}.`
    )
  }

  const caregivers = people
    .filter((person) => person.relationshipToClient === "other_caregiver")
    .sort((a, b) => a.startedOn.localeCompare(b.startedOn))
  for (const caregiver of caregivers) {
    const from = ageOn(dateOfBirth, caregiver.startedOn)
    const until = ageOn(dateOfBirth, caregiver.endedOn)
    const span =
      from != null && until != null
        ? `From the age of ${from} to ${until}`
        : from != null
          ? `From the age of ${from}`
          : until != null
            ? `Until the age of ${until}`
            : ""
    const kind = caregiver.caregiverRelationship
    let care = ""
    if (kind === "foster_carer") care = `${name} was in foster care`
    else if (kind === "kinship_carer") care = `${name} was in kinship care`
    else if (kind === "residential") care = `${name} was in residential care`
    else {
      const detail = caregiver.caregiverRelationshipDetail.trim() || (kind === "grandparent" ? "grandparent" : kind.replaceAll("_", " "))
      care = `${name} was mainly cared for by ${voice.possessive} ${lowerKeepingTypedCase(detail)}`
    }
    if (span || care) sentences.push(`${span ? `${span}, ` : ""}${care}.`)
  }

  const adoptedFamily = adoptive.length > 0
  const orderSiblings = people.filter(
    (person) => person.relationshipToClient === (adoptedFamily ? "sibling_adoptive" : "sibling_full")
  )
  const living = orderSiblings.filter((person) => !deceased(person))
  const clientYears = dateOfBirth ? personAge(dateOfBirth, asOf) : null
  const livingAged = living.every((person) => person.dateOfBirth && personAge(person.dateOfBirth, asOf) != null)
  if (clientYears != null && livingAged && living.length > 0) {
    const ages = living.map((person) => ({ person, age: personAge(person.dateOfBirth, asOf) ?? 0 }))
    const older = ages.filter((item) => item.age > clientYears)
    const total = living.length + 1
    const place =
      older.length === 0
        ? total === 2
          ? "the elder"
          : "the eldest"
        : older.length === living.length
          ? total === 2
            ? "the younger"
            : "the youngest"
          : `the ${ordinal(older.length + 1)}`
    const listed = ages
      .sort((a, b) => b.age - a.age)
      .map((item) => {
        const relative = item.age > clientYears ? "older" : "younger"
        return `a ${relative} ${siblingSex(item.person)}, ${item.age}`
      })
    const family = adoptedFamily ? ` in ${voice.possessive} adoptive family` : ""
    const withSiblings = listed.length === 1 ? listed[0] : `${listed.slice(0, -1).join(", ")}, and ${listed[listed.length - 1]}`
    sentences.push(`${name} is ${place} of ${countWord(total)} children${family}, with ${withSiblings}.`)
  } else if (living.length > 0) {
    sentences.push(`${name} has ${countWord(living.length)} ${living.length === 1 ? "sibling" : "siblings"}.`)
  }

  for (const person of orderSiblings.filter(deceased)) {
    const age = person.dateOfDeath ? ageOn(dateOfBirth, person.dateOfDeath) : null
    const role = siblingSex(person)
    const earlier = living.filter((row) => siblingSex(row) === role).length
    const label = earlier > 0 ? `second ${role}` : role
    sentences.push(age != null ? `A ${label} died when ${name} was ${age}.` : `A ${label} is deceased.`)
  }

  const extras: { side: string; kind: string; people: RelationshipRecord[] }[] = []
  for (const kind of ["sibling_half", "sibling_step"] as const) {
    const rows = people.filter((person) => person.relationshipToClient === kind && !deceased(person))
    const buckets = new Map<string, RelationshipRecord[]>()
    for (const person of rows) {
      const side =
        kind === "sibling_half"
          ? halfSiblingSide(person, people, partnerships)
          : stepSide(person, people, partnerships)
      const key = `${side ?? ""} ${kind === "sibling_half" ? "half-sibling" : "step-sibling"}`
      buckets.set(key, [...(buckets.get(key) ?? []), person])
    }
    for (const [key, group] of buckets) extras.push({ side: key, kind, people: group })
  }
  if (extras.length > 0) {
    const bits = extras.map((group) => {
      const ages = group.people
        .map((person) => (person.dateOfBirth ? personAge(person.dateOfBirth, asOf) : null))
        .filter((age): age is number => age != null)
      const noun = `${countWord(group.people.length)} ${group.side}`.replace("  ", " ").trim()
      return ages.length > 0 ? `${noun}, ${ages.join(" and ")}` : noun
    })
    sentences.push(`${voice.Subject} also ${agree(voice, "has", "have")} ${joinAnd(bits)}.`)
  }

  return sentences.length > 0 ? sentences.join(" ") : null
}

function ordinal(value: number): string {
  const words = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"]
  return words[value] ?? String(value)
}

function stepSide(
  person: RelationshipRecord,
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): "maternal" | "paternal" | null {
  const link = stepParentLinks(people, partnerships).find((item) => item.partnershipRecordId === person.partnershipRecordId)
  if (!link) return null
  const sex = sexWord(link.parent.sex)
  if (link.parent.relationshipToClient === "mother" || sex === "female") return "maternal"
  if (link.parent.relationshipToClient === "father" || sex === "male") return "paternal"
  return null
}

function describeParentsBonds(
  group: RelationshipRecord[],
  partnerships: PartnershipRecord[],
  voice: ReportVoice,
  dateOfBirth: string | null,
  sentences: string[],
  qualified: boolean
) {
  const ids = new Set(group.map((person) => person.relationshipRecordId))
  for (const partnership of partnerships) {
    if (!ids.has(partnership.partnerAId) || !ids.has(partnership.partnerBId)) continue
    const a = group.find((person) => person.relationshipRecordId === partnership.partnerAId)
    const b = group.find((person) => person.relationshipRecordId === partnership.partnerBId)
    if (!a || !b) continue
    const status = partnership.relationshipStatus
    const ended = partnership.ended.trim()
    const endedAge = ended ? ageOn(dateOfBirth, ended) : null
    const oneDead = [a, b].filter(deceased)
    const label = qualified ? (a.parentType === "adoptive" ? "adoptive parents" : "birth parents") : "parents"
    if (!ended && oneDead.length === 1 && (status === "married" || status === "defacto" || status === "")) {
      const role = parentWord(oneDead[0], false)
      const together = status === "defacto" ? "were together" : "were married"
      sentences.push(`${voice.Possessive} ${label} ${together} until ${voice.possessive} ${role}'s death.`)
      continue
    }
    if (status === "divorced" || status === "separated") {
      sentences.push(
        endedAge != null
          ? `${voice.Possessive} ${label} ${status} when ${voice.subject} ${agree(voice, "was", "were")} ${endedAge}.`
          : `${voice.Possessive} ${label} are ${status}.`
      )
      continue
    }
    if (status === "married" && !ended) sentences.push(`${voice.Possessive} ${label} are married.`)
    if (status === "defacto" && !ended) sentences.push(`${voice.Possessive} ${label} are together.`)
  }
}

/** "Ben01 is currently taking sertraline, supervised by Dr Harry TestDoc, GP." */
export function currentMedicationParagraph(
  events: DatedEvent[],
  name: string,
  professionals: ProfessionalOption[]
): string | null {
  const ongoing = events.filter(
    (event) => event.eventType === "medication" && resolvedAbout(event) === "self" && isOngoing(event)
  )
  if (ongoing.length === 0) return null
  const parts = ongoing.map((event) => {
    const title = titled(event, "medication")
    const professional = professionals.find((item) => item.professionalId === event.prescriberProfessionalId)
    const supervisor = professional
      ? [professionalSummary(professional).replace(/, [^,]+$/, ""), reportProfession(professional.professionName)]
          .filter(Boolean)
          .join(", ")
      : event.prescriberName.trim()
    return supervisor ? `${title}, supervised by ${supervisor}` : title
  })
  return `${name} is currently taking ${joinAnd(parts)}.`
}

export function conditionParagraph(
  kind: "illness_injury" | "emotional_problems" | "substance_use" | "self_harm" | "traumatic_event" | "significant_history",
  events: EventRecord[],
  name: string,
  voice: ReportVoice,
  dateOfBirth: string | null
): string | null {
  const rows = sortByStart(
    events.filter((event) => event.eventType === kind && resolvedAbout(event) === "self"),
    dateOfBirth
  )
  if (rows.length === 0) return null
  const linked = rows.flatMap((event) => treatmentsForCondition(events, event.eventRecordId))
  if (kind === "illness_injury") {
    const care = linkedTreatmentsSentence(linked, voice, dateOfBirth)
    return [illnessInjurySentence(rows, name, dateOfBirth), care].filter(Boolean).join(" ")
  }
  if (kind === "emotional_problems") {
    const care = linkedTreatmentsSentence(linked, voice, dateOfBirth)
    return [emotionalProblemsSentence(rows, name, dateOfBirth), care].filter(Boolean).join(" ")
  }
  if (kind === "substance_use") return substanceUseSentence(rows, linked, name, dateOfBirth)
  if (kind === "self_harm") return selfHarmSentence(rows, name, dateOfBirth)
  if (kind === "traumatic_event") return traumaticEventsSentence(rows, name, dateOfBirth)
  return otherSignificantEventsSentence(rows, name, dateOfBirth)
}

export function unlinkedTreatmentsParagraph(events: EventRecord[], name: string, dateOfBirth: string | null): string | null {
  const rows = events.filter(
    (event) =>
      (event.eventType === "psychiatric_admission" || event.eventType === "previous_therapy" || event.eventType === "medication") &&
      resolvedAbout(event) === "self" &&
      !event.conditionEventId
  )
  if (rows.length === 0) return null
  return unlinkedTreatmentSentence(rows, name, dateOfBirth)
}
