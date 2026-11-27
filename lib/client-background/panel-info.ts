/**
 * Pure info-page field lists for the shared SidePanel (Round AP.1).
 * Every field is present; empty values are marked "Not recorded".
 */

import {
  blockStatusDisplayLabel,
  childrenAnswerLabel,
  relationshipPanelTitle,
  yearOf,
} from "@/lib/client-background/relationship-panel-display"
import { personAge } from "@/lib/reports/background-report-prose"
import {
  ARRANGEMENT_TYPE_LABELS,
  CAREGIVER_RELATIONSHIP_LABELS,
  CHILD_TYPE_LABELS,
  CONDITION_CATEGORY_LABELS,
  DEPENDENCY_LABELS,
  EVENT_TYPE_LABELS,
  HEALTH_STATUS_LABELS,
  RELATIONSHIP_LIVING_SITUATION_LABELS,
  RELATIONSHIP_RATING_LABELS,
  SIBLING_BLOCK_TYPE_LABELS,
  type ArrangementType,
  type EventRecord,
  type HistoryIssue,
  type RelationshipBlock,
  type RelationshipRecord,
  type StartPrecision,
} from "@/lib/client-background/types"

function roleTypeLabel(role: string, value: string): string {
  if (!value) return ""
  if (role === "child" && value in CHILD_TYPE_LABELS) {
    return CHILD_TYPE_LABELS[value as keyof typeof CHILD_TYPE_LABELS]
  }
  if (role === "sibling" && value in SIBLING_BLOCK_TYPE_LABELS) {
    return SIBLING_BLOCK_TYPE_LABELS[value as keyof typeof SIBLING_BLOCK_TYPE_LABELS]
  }
  if (role === "parent") return value === "father" ? "Father" : "Mother"
  if (role === "caregiver" && value in CAREGIVER_RELATIONSHIP_LABELS) {
    return CAREGIVER_RELATIONSHIP_LABELS[value as keyof typeof CAREGIVER_RELATIONSHIP_LABELS]
  }
  return value
}

export const NOT_RECORDED = "Not recorded"

export type InfoField = {
  label: string
  value: string
  empty: boolean
}

export type InfoGroup = {
  id: string
  title: string
  fields: InfoField[]
}

function field(label: string, value: string | null | undefined): InfoField {
  const trimmed = (value ?? "").trim()
  return { label, value: trimmed || NOT_RECORDED, empty: !trimmed }
}

function dated(precision: StartPrecision | "", value: string): string {
  if (!value.trim()) return ""
  if (precision === "age") return `age ${value.trim()}`
  return value.trim()
}

/** Person info page: Person's details · Health · Home · Relationship with client. */
export function personInfoGroups(
  person: RelationshipRecord,
  options?: { asOf?: string }
): InfoGroup[] {
  const asOf = options?.asOf ?? new Date().toISOString().slice(0, 10)
  const age = person.dateOfBirth.trim() ? personAge(person.dateOfBirth, asOf) : null
  const born = yearOf(person.dateOfBirth)
  const dob =
    person.dateOfBirth.trim()
      ? age != null
        ? born
          ? `${person.dateOfBirth.trim()} · age ${age}`
          : person.dateOfBirth.trim()
        : person.dateOfBirth.trim()
      : age != null
        ? String(age)
        : ""

  const details: InfoField[] = [
    field("Name", person.notKnown ? "Not known" : person.givenName),
    field("Sex", person.sex),
  ]
  if (person.blockRole === "child" || person.blockRole === "sibling") {
    details.push(field("Type", roleTypeLabel(person.blockRole, person.blockRoleType ?? "")))
  }
  if (person.blockRole === "parent") {
    details.push(field("Parent", person.blockRoleType === "father" ? "Father" : "Mother"))
  }
  if (person.blockRole === "caregiver") {
    details.push(field("Relationship", roleTypeLabel("caregiver", person.blockRoleType ?? "")))
  }
  details.push(field("Date of birth or age", dob))

  const health: InfoField[] = [
    field("Health", person.healthStatus ? HEALTH_STATUS_LABELS[person.healthStatus] : ""),
    field("Year of death", yearOf(person.dateOfDeath) || person.dateOfDeath),
  ]

  const home: InfoField[] = [
    field(
      "Living situation",
      person.livingSituation ? RELATIONSHIP_LIVING_SITUATION_LABELS[person.livingSituation] : ""
    ),
    field("Dependency", person.dependency ? DEPENDENCY_LABELS[person.dependency] : ""),
  ]

  const quality: InfoField[] = [
    field("Supportive", person.supportive ? RELATIONSHIP_RATING_LABELS[person.supportive] : ""),
    field("Conflict or strain", person.conflict ? RELATIONSHIP_RATING_LABELS[person.conflict] : ""),
    field("Comment", person.qualityOfRelationship),
  ]

  return [
    { id: "details", title: "Person's details", fields: details },
    { id: "health", title: "Health", fields: health },
    { id: "home", title: "Home", fields: home },
    { id: "relationship", title: "Relationship with client", fields: quality },
  ]
}

/** Relationship info page. */
export function relationshipInfoGroups(block: RelationshipBlock): InfoGroup[] {
  const fields: InfoField[] = []
  if (block.kind === "caregiver_arrangement") {
    fields.push(
      field(
        "Arrangement",
        block.arrangementType === "other"
          ? block.arrangementDetail
          : block.arrangementType
            ? ARRANGEMENT_TYPE_LABELS[block.arrangementType as ArrangementType]
            : ""
      )
    )
    if (block.arrangementType === "other") {
      fields.push(field("Other arrangement", block.arrangementDetail))
    }
  } else if (block.kind === "client_other_children") {
    fields.push(field("Relationship", block.statusDetail))
  } else {
    fields.push(field("Relationship status", blockStatusDisplayLabel(block.status)))
    if (block.status === "other") fields.push(field("Other status", block.statusDetail))
  }
  if (block.kind !== "client_other_children") {
    fields.push(field("Started", yearOf(block.startedOn) || block.startedOn))
    fields.push(field("Ended", yearOf(block.endedOn) || block.endedOn))
  }
  if (block.kind === "client_current" || block.kind === "client_previous") {
    fields.push(field("Children", childrenAnswerLabel(block.childrenAnswer)))
  }
  if (block.kind === "parent_other" || block.kind === "caregiver_arrangement" || block.kind === "biological_parents") {
    fields.push(field("Siblings", childrenAnswerLabel(block.siblingsAnswer)))
  }
  return [{ id: "relationship", title: "Relationship", fields }]
}

/** Issue info page: Issue · Course. */
export function issueInfoGroups(
  issue: HistoryIssue,
  firstEpisode?: EventRecord | null
): InfoGroup[] {
  const issueFields: InfoField[] = [
    field(
      "Category",
      issue.category in CONDITION_CATEGORY_LABELS
        ? CONDITION_CATEGORY_LABELS[issue.category as keyof typeof CONDITION_CATEGORY_LABELS]
        : issue.category
    ),
    field("Title", issue.title),
  ]
  const course: InfoField[] = [
    field(
      "Started",
      firstEpisode ? dated(firstEpisode.startPrecision, firstEpisode.startValue) : ""
    ),
    field(
      "Ended",
      firstEpisode?.resolvedOrOngoing === "ongoing" || firstEpisode?.endOngoing
        ? "Ongoing"
        : firstEpisode
          ? dated(firstEpisode.endPrecision, firstEpisode.endValue)
          : ""
    ),
  ]
  return [
    { id: "issue", title: "Issue", fields: issueFields },
    { id: "course", title: "Course", fields: course },
  ]
}

/** Event info page — core fields always listed. */
export function eventInfoGroups(event: EventRecord): InfoGroup[] {
  const fields: InfoField[] = [
    field("Type", EVENT_TYPE_LABELS[event.eventType] ?? event.eventType),
    field("Title", event.title),
    field("Started", dated(event.startPrecision, event.startValue)),
    field(
      "Ended",
      event.resolvedOrOngoing === "ongoing" || event.endOngoing
        ? "Ongoing"
        : dated(event.endPrecision, event.endValue)
    ),
    field("Description", event.description),
  ]
  if (event.admissionType) fields.push(field("Admission type", event.admissionType))
  if (event.facility) fields.push(field("Facility", event.facility))
  if (event.admissionLength) fields.push(field("Length", event.admissionLength))
  if (event.prescriberName) fields.push(field("Prescriber", event.prescriberName))
  if (event.substanceStatus) fields.push(field("Substance status", event.substanceStatus))
  return [{ id: "event", title: "Event", fields }]
}

export function relationshipSummaryLine(block: RelationshipBlock): string {
  const title = relationshipPanelTitle(block)
  const start = yearOf(block.startedOn)
  const end = yearOf(block.endedOn)
  if (start && end) return `${title} · ${start}–${end}`
  if (start) return `${title} · since ${start}`
  return title
}
