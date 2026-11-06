import { assessAge, clientAgeAtStart, compareEventsChronologically } from "@/lib/client-background/age"
import { conditionGroups } from "@/lib/client-background/condition-groups"
import { resolvedAbout } from "@/lib/client-background/interview-history"
import { treatmentsForCondition } from "@/lib/client-background/history-links"
import { parsePartialDate, precisionForPartialDate } from "@/lib/client-background/partial-date"
import { professionalSummary, type ProfessionalOption } from "@/lib/client-background/professionals"
import {
  ADMISSION_TYPE_LABELS,
  type AdmissionType,
  type EventRecord,
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
  | "about"
  | "prescriberName"
  | "prescriberProfessionalId"
  | "relationshipRecordId"
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
  const groups = conditionGroups(events as EventRecord[], dateOfBirth).sort((a, b) =>
    compareEventsChronologically(a.episodes[0], b.episodes[0], dateOfBirth)
  )
  const bits: string[] = []
  for (const group of groups) {
    const label = titled(group.episodes[0], "emotional problems")
    group.episodes.forEach((event, index) => {
      const when = eventWhenPhrase(event, dateOfBirth, "starting")
      bits.push(
        index === 0
          ? ["a history of " + label, when].filter(Boolean).join(" ")
          : ["again", when].filter(Boolean).join(" ")
      )
    })
  }
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
