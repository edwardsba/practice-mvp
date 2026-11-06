import { compareEventsChronologically } from "@/lib/client-background/age"
import { conditionGroups } from "@/lib/client-background/condition-groups"
import { isConditionEvent, isTreatmentEvent, treatmentsForCondition } from "@/lib/client-background/history-links"
import { resolvedAbout } from "@/lib/client-background/interview-history"
import type { EventRecord, EventType, RelationshipRecord } from "@/lib/client-background/types"
import {
  lowerKeepingTypedCase,
  personAge,
  yearOf,
  type ReportVoice,
} from "@/lib/reports/background-report-prose"

function deceased(person: RelationshipRecord): boolean {
  return person.deceased || person.healthStatus === "deceased"
}

function sexWord(sex: string): "female" | "male" | "" {
  const value = sex.trim().toLowerCase()
  if (value === "female") return "female"
  if (value === "male") return "male"
  return ""
}

function isChild(person: RelationshipRecord): boolean {
  return person.relationshipToClient === "child_biological" || person.relationshipToClient === "child_step"
}

function siblingSex(person: RelationshipRecord): string {
  const sex = sexWord(person.sex)
  if (sex === "female") return "sister"
  if (sex === "male") return "brother"
  return "sibling"
}

const SIGNIFICANT_ORDER = [
  "illness_injury",
  "emotional_problems",
  "substance_use",
  "self_harm",
  "psychiatric_admission",
  "traumatic_event",
  "previous_therapy",
  "medication",
  "significant_history",
] as const

function roleWord(person: RelationshipRecord): string {
  if (person.relationshipToClient === "mother") return "mother"
  if (person.relationshipToClient === "father") return "father"
  if (person.relationshipToClient === "step_parent") return "step-parent"
  if (person.relationshipToClient === "current_partner" || person.relationshipToClient === "prior_partner") return "partner"
  if (person.relationshipToClient === "sibling_full" || person.relationshipToClient === "sibling_adoptive") return siblingSex(person)
  if (person.relationshipToClient === "sibling_half") return `half-${siblingSex(person)}`
  if (person.relationshipToClient === "sibling_step") return `step-${siblingSex(person)}`
  if (isChild(person)) return "child"
  if (person.relationshipToClient === "other_caregiver") return "caregiver"
  return "relative"
}

function conditionText(event: EventRecord, role: string, kind: string, past: boolean): string {
  let title = lowerKeepingTypedCase(event.title.trim())
  if (role && title.startsWith(`${role} `)) title = title.slice(role.length + 1).trim()
  if (/^(died|was|has|had)\b/i.test(event.title.trim())) return event.title.trim().replace(/\.$/, "")
  const verb = past ? "had" : "has"
  if (kind === "substance_use") return `${verb} a history of problems with ${title || "alcohol or drugs"}`
  if (kind === "self_harm") return title ? `${verb} a history of ${title}` : `${verb} a history of self-harm`
  if (kind === "psychiatric_admission") return past ? "had been admitted to hospital" : "has been admitted to hospital"
  return `${verb} a history of ${title || "significant events"}`
}

function historyUnits(kind: string, matched: EventRecord[]): { event: EventRecord; episodes: EventRecord[] }[] {
  if (isTreatmentEvent(kind as EventType)) {
    return matched.filter((event) => !event.conditionEventId).map((event) => ({ event, episodes: [event] }))
  }
  if (isConditionEvent(kind as EventType)) {
    return conditionGroups(matched).map((group) => ({ event: group.episodes[0], episodes: group.episodes }))
  }
  return matched.map((event) => ({ event, episodes: [event] }))
}

function sexPronoun(person: RelationshipRecord): string {
  const sex = sexWord(person.sex)
  if (sex === "female") return "she"
  if (sex === "male") return "he"
  return "they"
}

function familyTreatmentClause(event: EventRecord, past: boolean): string {
  const year = yearOf(event.startPrecision, event.startValue)
  const when = year ? ` (${year})` : ""
  if (event.eventType === "psychiatric_admission") {
    if (event.admissionType === "residential_rehab") return `attended residential rehab${when}`
    if (event.admissionType === "medical" || event.admissionType === "emergency_department") return `was admitted to hospital${when}`
    return `was admitted to a psychiatric unit${when}`
  }
  if (event.eventType === "previous_therapy") {
    const who = lowerKeepingTypedCase(event.title.trim()) || "therapist"
    return `saw ${/^(a|an)\s/i.test(who) ? who : `a ${who}`}`
  }
  const named = event.title.trim()
  const medication = named && named.toLowerCase() !== "medication" ? lowerKeepingTypedCase(named) : ""
  const ended = past || !(event.endOngoing || event.resolvedOrOngoing === "ongoing")
  if (ended) return medication ? `took ${medication}` : "took medication"
  return medication ? `takes ${medication}` : "takes medication"
}

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ""
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`
}

function withTreatment(base: string, care: EventRecord[], past: boolean, pronoun: string): string {
  if (care.length === 0) return `${base}.`
  return `${base}, for which ${pronoun} ${joinClauses(care.map((event) => familyTreatmentClause(event, past)))}.`
}

/** Section 6. One paragraph per heading. The first sentence names the client; later sentences use the pronoun. */
function sectionPersonTag(person: RelationshipRecord, asOf: string): string {
  const name = person.givenName.trim()
  if (deceased(person)) return name ? ` (${name}, deceased)` : " (deceased)"
  if (name) return ` (${name})`
  const age = person.dateOfBirth && asOf ? personAge(person.dateOfBirth, asOf) : null
  return age != null ? ` (${age} years old)` : ""
}

export function significantOtherParagraphs(
  name: string,
  people: RelationshipRecord[],
  events: EventRecord[],
  voice?: ReportVoice,
  asOf = ""
): string[] {
  const rows = events.filter((event) => resolvedAbout(event) === "significant_other")
  const paragraphs: string[] = []
  const laterOwner = voice && voice.kind !== "name" ? voice.Possessive : "Their"
  for (const kind of SIGNIFICANT_ORDER) {
    const matched = rows.filter((event) => (event.eventType === "family_events" ? "emotional_problems" : event.eventType) === kind)
    if (matched.length === 0) continue
    const units = historyUnits(kind, matched)
    const sentences = units.map((unit, index) => {
      const event = unit.event
      const care = unit.episodes
        .flatMap((episode) => treatmentsForCondition(events, episode.eventRecordId))
        .sort((a, b) => {
          const aMissing = !a.startValue.trim()
          const bMissing = !b.startValue.trim()
          if (aMissing !== bMissing) return aMissing ? 1 : -1
          return compareEventsChronologically(a, b, null)
        })
      const person = event.relationshipRecordId
        ? people.find((row) => row.relationshipRecordId === event.relationshipRecordId)
        : undefined
      if (person) {
        const role = roleWord(person)
        const detail = conditionText(event, role, kind, deceased(person))
        const owner = index === 0 ? `${name}'s` : laterOwner
        return withTreatment(`${owner} ${role}${sectionPersonTag(person, asOf)} ${detail}`, care, deceased(person), sexPronoun(person))
      }
      const other = event.aboutOther.trim()
      const who = other ? `A ${lowerKeepingTypedCase(other)} of ${name}'s` : `A significant other of ${name}'s`
      const detail = conditionText(event, "", kind, false)
      return withTreatment(`${who} ${detail}`, care, false, "they")
    })
    if (sentences.length > 0) paragraphs.push(sentences.join(" "))
  }
  return paragraphs
}
