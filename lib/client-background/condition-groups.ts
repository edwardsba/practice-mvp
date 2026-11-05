import { compareEventsChronologically } from "@/lib/client-background/age"
import { resolvedAbout } from "@/lib/client-background/interview-history"
import { isConditionEvent } from "@/lib/client-background/history-links"
import {
  EVENT_TYPE_LABELS,
  type ConditionEventType,
  type EventRecord,
} from "@/lib/client-background/types"

export type ConditionGroup = {
  id: string
  eventType: ConditionEventType
  personKey: string
  /** Earliest episode's title, or the type label when that title is blank. */
  title: string
  episodes: EventRecord[]
}

export function personKey(
  event: Pick<EventRecord, "about" | "attribution" | "relationshipRecordId" | "aboutOther">
): string {
  if (resolvedAbout(event) === "self") return "self"
  if (event.relationshipRecordId) return `person:${event.relationshipRecordId}`
  return `other:${event.aboutOther.trim().toLowerCase()}`
}

export function samePerson(
  a: Pick<EventRecord, "about" | "attribution" | "relationshipRecordId" | "aboutOther">,
  b: Pick<EventRecord, "about" | "attribution" | "relationshipRecordId" | "aboutOther">
): boolean {
  return personKey(a) === personKey(b)
}

function storedGroupId(event: EventRecord): string {
  return event.conditionGroupId?.trim() ?? ""
}

/** Real id when one was saved. Otherwise the person, type, and trimmed title. */
export function conditionGroupKey(event: EventRecord): string {
  const stored = storedGroupId(event)
  if (stored) return stored
  return `title:${personKey(event)}:${event.eventType}:${event.title.trim().toLowerCase()}`
}

export function conditionGroups(events: EventRecord[], dateOfBirth: string | null = null): ConditionGroup[] {
  const buckets = new Map<string, EventRecord[]>()
  for (const event of events) {
    if (!isConditionEvent(event.eventType)) continue
    const key = conditionGroupKey(event)
    const list = buckets.get(key) ?? []
    list.push(event)
    buckets.set(key, list)
  }
  return [...buckets.entries()].map(([id, episodes]) => {
    const sorted = [...episodes].sort((a, b) => compareEventsChronologically(a, b, dateOfBirth))
    const first = sorted[0]
    return {
      id,
      eventType: first.eventType as ConditionEventType,
      personKey: personKey(first),
      title: first.title.trim() || EVENT_TYPE_LABELS[first.eventType],
      episodes: sorted,
    }
  })
}

/**
 * The condition this entry should join, from its title.
 * Blank when the title does not match another condition for the same person and type.
 */
export function matchingConditionGroup(events: EventRecord[], draft: EventRecord, dateOfBirth: string | null = null): ConditionGroup | null {
  if (!isConditionEvent(draft.eventType)) return null
  const title = draft.title.trim().toLowerCase()
  if (!title) return null
  return (
    conditionGroups(events, dateOfBirth).find(
      (group) =>
        group.eventType === draft.eventType &&
        group.personKey === personKey(draft) &&
        group.title.trim().toLowerCase() === title &&
        group.episodes.some((episode) => episode.eventRecordId !== draft.eventRecordId)
    ) ?? null
  )
}

export type BackfillAssignment = {
  clientId: string
  eventRecordId: string
  conditionGroupId: string
}

export type BackfillPlan = {
  assignments: BackfillAssignment[]
  groupsMade: number
  byClient: { clientId: string; groups: number }[]
}

/**
 * One group per client, person, condition type, and title (trimmed, case-insensitive).
 * Ids are supplied so the caller can log the plan without writing.
 */
export function planConditionBackfill(
  rows: { clientId: string; event: EventRecord }[],
  ids: () => string
): BackfillPlan {
  const buckets = new Map<string, { clientId: string; event: EventRecord }[]>()
  for (const row of rows) {
    if (!isConditionEvent(row.event.eventType)) continue
    if (storedGroupId(row.event)) continue
    const key = `${row.clientId}:${conditionGroupKey(row.event)}`
    const list = buckets.get(key) ?? []
    list.push(row)
    buckets.set(key, list)
  }
  const assignments: BackfillAssignment[] = []
  const counts = new Map<string, number>()
  for (const list of buckets.values()) {
    const conditionGroupId = ids()
    const clientId = list[0].clientId
    counts.set(clientId, (counts.get(clientId) ?? 0) + 1)
    for (const row of list) {
      assignments.push({ clientId, eventRecordId: row.event.eventRecordId, conditionGroupId })
    }
  }
  return {
    assignments,
    groupsMade: buckets.size,
    byClient: [...counts.entries()]
      .map(([clientId, groups]) => ({ clientId, groups }))
      .sort((a, b) => a.clientId.localeCompare(b.clientId)),
  }
}
