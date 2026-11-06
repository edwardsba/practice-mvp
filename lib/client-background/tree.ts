import { assessAge, displayedAge } from "@/lib/client-background/age"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import {
  CAREGIVER_RELATIONSHIP_LABELS,
  CAREGIVER_RELATIONSHIPS,
  isOneOf,
  RELATIONSHIP_TO_CLIENT_LABELS,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import { todayDateString } from "@/lib/dates/practice-time"

export function personRoleLabel(record: Pick<RelationshipRecord, "relationshipToClient">): string {
  return RELATIONSHIP_TO_CLIENT_LABELS[record.relationshipToClient]
}

function treeAgeToken(
  person: Pick<RelationshipRecord, "dateOfBirth" | "healthStatus">,
  asOf: string
): string | null {
  if (person.healthStatus === "deceased") return null
  const age = assessAge(parsePartialDate(person.dateOfBirth), parsePartialDate(asOf), "person")
  const label = displayedAge(age)
  return label && age.kind !== "before_birth" ? label : null
}

export function relationshipLineLabel(
  person: Pick<
    RelationshipRecord,
    | "relationshipToClient"
    | "givenName"
    | "dateOfBirth"
    | "healthStatus"
    | "caregiverRelationship"
    | "caregiverRelationshipDetail"
  >,
  status?: string | null,
  asOf = todayDateString()
): string {
  if (person.relationshipToClient === "other_caregiver") {
    const name = person.givenName.trim()
    const code = person.caregiverRelationship.trim()
    const relation = isOneOf(code, CAREGIVER_RELATIONSHIPS)
      ? code === "other"
        ? person.caregiverRelationshipDetail.trim() || CAREGIVER_RELATIONSHIP_LABELS.other
        : CAREGIVER_RELATIONSHIP_LABELS[code]
      : code
    let label = name ? `Other primary caregiver – ${name}` : "Other primary caregiver"
    if (relation) label += ` (${relation})`
    const age = treeAgeToken(person, asOf)
    if (age) label += ` – ${age}`
    const statusText = status?.trim()
    if (statusText) label += ` – ${statusText}`
    return label
  }

  const parts = [personRoleLabel(person)]
  const name = person.givenName.trim()
  if (name) parts.push(name)
  const age = treeAgeToken(person, asOf)
  if (age) parts.push(age)
  const statusText = status?.trim()
  if (statusText) parts.push(statusText)
  return parts.join(" – ")
}

/** Relatives recorded as living with the client, for the demographics living-situation list. */
export function livingWithClientLines(people: RelationshipRecord[]): string[] {
  return people.flatMap((person) => {
    const partTime = person.livingSituation === "lives_with_client_part_time"
    const fullTime = person.livingSituation === "lives_with_client_full_time"
    if (!partTime && !fullTime) return []
    const name = person.givenName.trim() || "Not recorded"
    const suffix = partTime ? " (part-time)" : ""
    return [`${RELATIONSHIP_TO_CLIENT_LABELS[person.relationshipToClient]} — ${name}${suffix}`]
  })
}

export function personName(record: Pick<RelationshipRecord, "givenName" | "relationshipToClient">): string {
  const name = record.givenName.trim()
  return name || personRoleLabel(record)
}
