import { clientAgeAtStart, compareEventsChronologically } from "@/lib/client-background/age"
import { conditionGroups, personKey, type ConditionGroup } from "@/lib/client-background/condition-groups"
import { isConditionEvent, isTreatmentEvent, treatmentsForCondition } from "@/lib/client-background/history-links"
import { resolvedAbout, type ScreeningAnswers } from "@/lib/client-background/interview-history"
import { professionalSummary, type ProfessionalOption } from "@/lib/client-background/professionals"
import {
  ADMISSION_TYPE_LABELS,
  EVENT_TYPE_LABELS,
  type EventRecord,
  type EventType,
  type RelationshipRecord,
  type StartPrecision,
} from "@/lib/client-background/types"

export type HistoryTreeNode =
  | { kind: "section"; title: string; children: HistoryTreeNode[] }
  | { kind: "band"; id: string; heading: string; meta: string; children: HistoryTreeNode[] }
  | { kind: "row"; id: string; line: string; children: HistoryTreeNode[] }
  | { kind: "note"; text: string }

export type HistoryTreeCard = { title: string; children: HistoryTreeNode[] }

export type HistoryTree = { client: HistoryTreeCard; family: HistoryTreeCard }

type Input = {
  events: EventRecord[]
  relationships: RelationshipRecord[]
  dateOfBirth: string | null
  screening: ScreeningAnswers
  professionals?: ProfessionalOption[]
}

const CLIENT_SECTIONS: { title: string; screening: keyof ScreeningAnswers; eventType: EventType; mode: "condition" | "event" }[] = [
  { title: "Mental health", screening: "emotional_problems", eventType: "emotional_problems", mode: "condition" },
  { title: "Substance use", screening: "substance_use", eventType: "substance_use", mode: "condition" },
  { title: "Physical health", screening: "illness_injury", eventType: "illness_injury", mode: "condition" },
  { title: "Self-harm", screening: "self_harm", eventType: "self_harm", mode: "event" },
  { title: "Traumatic events", screening: "traumatic_events", eventType: "traumatic_event", mode: "event" },
  { title: "Other significant events", screening: "other_significant_events", eventType: "significant_history", mode: "event" },
]

export function buildHistoryTree(input: Input): HistoryTree {
  const self = input.events.filter((event) => resolvedAbout(event) === "self")
  const sections: HistoryTreeNode[] = CLIENT_SECTIONS.map((section) => {
    const matched = self.filter((event) => event.eventType === section.eventType)
    const children =
      section.mode === "condition"
        ? conditionNodes(matched, input, false)
        : matched
            .sort((a, b) => compareEventsChronologically(a, b, input.dateOfBirth))
            .map((event) => row(event.eventRecordId, eventLine(event, input.dateOfBirth)))
    if (children.length === 0) {
      const answer = input.screening[section.screening]
      const note = answer === "yes" ? [] : [{ kind: "note" as const, text: answer === "no" ? "None" : "Not asked" }]
      return { kind: "section", title: section.title, children: note }
    }
    return { kind: "section", title: section.title, children }
  })
  const unlinked = self.filter((event) => isTreatmentEvent(event.eventType) && !event.conditionEventId)
  if (unlinked.length > 0) {
    sections.push({
      kind: "section",
      title: "Not linked to a condition",
      children: unlinked
        .sort((a, b) => compareEventsChronologically(a, b, input.dateOfBirth))
        .map((event) => row(event.eventRecordId, treatmentLine(event, input))),
    })
  }
  return {
    client: { title: "Client history", children: sections },
    family: { title: "Family and significant others", children: familySections(input) },
  }
}

function conditionNodes(events: EventRecord[], input: Input, family: boolean): HistoryTreeNode[] {
  return conditionGroups(events, input.dateOfBirth)
    .sort((a, b) => compareGroups(a, b, input.dateOfBirth))
    .map((group) => conditionBand(group, input, family))
}

function conditionBand(group: ConditionGroup, input: Input, family: boolean): HistoryTreeNode {
  const current = group.episodes.some(ongoing)
  const heading = family
    ? [group.title, EVENT_TYPE_LABELS[group.eventType].toLowerCase()].join(" · ")
    : current
      ? `${group.title} · current`
      : group.title
  const meta =
    group.episodes.length > 1
      ? episodeSummary(group, input.dateOfBirth)
      : family
        ? datePhrase(group.episodes[0]).dates
        : spanLine(group.episodes[0], input.dateOfBirth)
  const nested =
    group.episodes.length > 1
      ? [...group.episodes].sort((a, b) => compareCurrentThenRecent(a, b, input.dateOfBirth)).map((episode) => episodeRow(episode, input))
      : treatmentNodes(group.episodes[0], input)
  return { kind: "band", id: group.id, heading, meta, children: nested }
}

function episodeRow(episode: EventRecord, input: Input): HistoryTreeNode {
  const when = spanLine(episode, input.dateOfBirth)
  const label = ongoing(episode) ? "Current episode" : "Episode"
  return {
    kind: "row",
    id: episode.eventRecordId,
    line: [label, when].filter(Boolean).join(" · "),
    children: treatmentNodes(episode, input),
  }
}

function treatmentNodes(episode: EventRecord, input: Input): HistoryTreeNode[] {
  const treatments = treatmentsForCondition(input.events, episode.eventRecordId).sort((a, b) =>
    compareEventsChronologically(a, b, input.dateOfBirth)
  )
  if (treatments.length === 0) return [{ kind: "note", text: "No treatment recorded" }]
  return treatments.map((treatment) => row(treatment.eventRecordId, treatmentLine(treatment, input)))
}

function episodeSummary(group: ConditionGroup, dateOfBirth: string | null): string {
  const phrases = [...group.episodes]
    .sort((a, b) => compareEventsChronologically(a, b, dateOfBirth))
    .map((episode) => datePhrase(episode).dates)
    .filter(Boolean)
  const count = `${group.episodes.length} episodes`
  return phrases.length > 0 ? `${count} · ${joinAnd(phrases)}` : count
}

function eventLine(event: EventRecord, dateOfBirth: string | null): string {
  const title = event.title.trim() || EVENT_TYPE_LABELS[event.eventType]
  const when = spanLine(event, dateOfBirth)
  return [title, when].filter(Boolean).join(" · ")
}

function treatmentLine(event: EventRecord, input: Input): string {
  const when = datePhrase(event)
  const ages = agePhrase(event, input.dateOfBirth)
  if (event.eventType === "psychiatric_admission" && event.admissionType === "residential_rehab") {
    return ["Residential rehab", when.dates, ages].filter(Boolean).join(" · ")
  }
  if (event.eventType === "psychiatric_admission") {
    const type = event.admissionType ? ADMISSION_TYPE_LABELS[event.admissionType].toLowerCase() : ""
    const length = event.admissionLength.trim()
    return ["Hospital admission", type, when.dates, ages, length].filter(Boolean).join(" · ")
  }
  if (event.eventType === "previous_therapy") {
    return ["Therapy", event.title.trim().toLowerCase(), when.dates, ages].filter(Boolean).join(" · ")
  }
  const prescriber = prescriberLabel(event, input.professionals ?? [])
  return ["Medication", event.title.trim().toLowerCase(), when.dates, ongoing(event) ? "ongoing" : "ended", prescriber]
    .filter(Boolean)
    .join(" · ")
}

function familySections(input: Input): HistoryTreeNode[] {
  const rows = input.events.filter((event) => resolvedAbout(event) === "significant_other")
  const keys = [...new Set(rows.map(personKey))]
  return keys
    .map((key) => ({ key, sample: rows.find((event) => personKey(event) === key)! }))
    .sort((a, b) => comparePeople(a.sample, b.sample, input.relationships))
    .map(({ key, sample }) => {
      const mine = rows.filter((event) => personKey(event) === key)
      const conditions = mine.filter((event) => isConditionEvent(event.eventType))
      const plain = mine.filter((event) => !isConditionEvent(event.eventType) && (!isTreatmentEvent(event.eventType) || !event.conditionEventId))
      const children = [
        ...conditionNodes(conditions, input, true),
        ...plain
          .sort((a, b) => compareEventsChronologically(a, b, input.dateOfBirth))
          .map((event) =>
            isTreatmentEvent(event.eventType)
              ? row(event.eventRecordId, treatmentLine(event, input))
              : row(event.eventRecordId, familyEventLine(event))
          ),
      ]
      return { kind: "section" as const, title: personHeading(sample, input.relationships), children }
    })
}

function familyEventLine(event: EventRecord): string {
  const title = event.title.trim() || EVENT_TYPE_LABELS[event.eventType]
  const type = EVENT_TYPE_LABELS[event.eventType].toLowerCase()
  const dates = datePhrase(event).dates
  return [title, type, dates].filter(Boolean).join(" · ")
}

function personHeading(event: EventRecord, people: RelationshipRecord[]): string {
  const person = event.relationshipRecordId
    ? people.find((item) => item.relationshipRecordId === event.relationshipRecordId)
    : undefined
  if (!person) {
    const other = event.aboutOther.trim() || event.familyRelation.trim()
    if (!other) return "Significant other"
    return other.slice(0, 1).toUpperCase() + other.slice(1)
  }
  const role = roleWord(person)
  const name = person.givenName.trim()
  const dead = person.deceased || person.healthStatus === "deceased"
  if (name && dead) return `${role} (${name}, deceased)`
  if (name) return `${role} (${name})`
  if (dead) return `${role} (deceased)`
  return role
}

function roleWord(person: RelationshipRecord): string {
  const rel = person.relationshipToClient
  if (rel === "mother" || person.blockRoleType === "mother") return "Mother"
  if (rel === "father" || person.blockRoleType === "father") return "Father"
  if (rel === "step_parent") return "Step-parent"
  if (rel === "current_partner" || rel === "prior_partner" || person.blockRole === "partner") return "Partner"
  if (rel.startsWith("child") || person.blockRole === "child") {
    if (person.sex === "Female") return "Daughter"
    if (person.sex === "Male") return "Son"
    return "Child"
  }
  if (rel.startsWith("sibling") || person.blockRole === "sibling") {
    if (person.sex === "Female") return "Sister"
    if (person.sex === "Male") return "Brother"
    return "Sibling"
  }
  if (rel === "other_caregiver" || person.blockRole === "caregiver") return "Caregiver"
  return "Relative"
}

function personRank(person: RelationshipRecord | undefined): number {
  if (!person) return 5
  const role = roleWord(person)
  if (role === "Mother") return 0
  if (role === "Father") return 1
  if (role === "Step-parent") return 2
  if (role === "Partner") return 3
  if (role === "Daughter" || role === "Son" || role === "Child") return 4
  if (role === "Sister" || role === "Brother" || role === "Sibling") return 5
  if (role === "Caregiver" || role === "Relative") return 6
  return 7
}

function comparePeople(a: EventRecord, b: EventRecord, people: RelationshipRecord[]): number {
  const personA = a.relationshipRecordId ? people.find((item) => item.relationshipRecordId === a.relationshipRecordId) : undefined
  const personB = b.relationshipRecordId ? people.find((item) => item.relationshipRecordId === b.relationshipRecordId) : undefined
  const rank = personRank(personA) - personRank(personB)
  if (rank !== 0) return rank
  return (personA?.displayOrder ?? 0) - (personB?.displayOrder ?? 0)
}

function compareGroups(a: ConditionGroup, b: ConditionGroup, dateOfBirth: string | null): number {
  const aCurrent = a.episodes.some(ongoing)
  const bCurrent = b.episodes.some(ongoing)
  if (aCurrent !== bCurrent) return aCurrent ? -1 : 1
  const aLatest = [...a.episodes].sort((left, right) => compareEventsChronologically(right, left, dateOfBirth))[0]
  const bLatest = [...b.episodes].sort((left, right) => compareEventsChronologically(right, left, dateOfBirth))[0]
  return compareEventsChronologically(bLatest, aLatest, dateOfBirth)
}

function compareCurrentThenRecent(a: EventRecord, b: EventRecord, dateOfBirth: string | null): number {
  const aOngoing = ongoing(a)
  const bOngoing = ongoing(b)
  if (aOngoing !== bOngoing) return aOngoing ? -1 : 1
  return compareEventsChronologically(b, a, dateOfBirth)
}

function row(id: string, line: string): HistoryTreeNode {
  return { kind: "row", id, line, children: [] }
}

function ongoing(event: EventRecord): boolean {
  return event.endOngoing || event.resolvedOrOngoing === "ongoing"
}

function yearOf(value: string): string {
  return /(\d{4})/.exec(value)?.[1] ?? ""
}

function datePhrase(event: EventRecord): { dates: string } {
  const start = yearOf(event.startValue)
  const end = yearOf(event.endValue)
  if (ongoing(event)) return { dates: start ? `since ${start}` : "" }
  if (start && end && start !== end) return { dates: `${start}–${end}` }
  return { dates: start || end }
}

function agePhrase(event: EventRecord, dateOfBirth: string | null): string {
  const start = clientAgeAtStart(dateOfBirth, event.startPrecision as StartPrecision | "", event.startValue)
  const end = clientAgeAtStart(dateOfBirth, event.endPrecision as StartPrecision | "", event.endValue)
  if (ongoing(event)) return start != null ? `from age ${start}` : ""
  if (start != null && end != null && start !== end) return `age ${start} to ${end}`
  if (start != null) return `age ${start}`
  if (end != null) return `age ${end}`
  return ""
}

function spanLine(event: EventRecord, dateOfBirth: string | null): string {
  return [datePhrase(event).dates, agePhrase(event, dateOfBirth)].filter(Boolean).join(" · ")
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ""
  if (parts.length === 2) return `${parts[0]}, and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`
}

function professionShort(value: string | null | undefined): string {
  const text = (value ?? "").trim()
  if (/^general practitioners?$/i.test(text) || /^g\.?p\.?$/i.test(text)) return "GP"
  return text
}

function prescriberLabel(event: EventRecord, professionals: ProfessionalOption[]): string {
  const professional = professionals.find((item) => item.professionalId === event.prescriberProfessionalId)
  if (!professional) return event.prescriberName.trim()
  const name = [professional.title?.trim(), professional.firstName.trim(), professional.lastName.trim()].filter(Boolean).join(" ")
  const profession = professionShort(professional.professionName)
  if (name && profession) return `${name}, ${profession}`
  return name || professionalSummary(professional)
}
