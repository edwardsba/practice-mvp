import { HISTORY_QUESTIONS, historyQuestionKeyForEvent, resolvedAbout } from "@/lib/client-background/interview-history"
import {
  CONDITION_EVENT_TYPES,
  TREATMENT_EVENT_TYPES,
  type EventRecord,
  type EventType,
} from "@/lib/client-background/types"

export function isConditionEvent(eventType: EventType): boolean {
  return (CONDITION_EVENT_TYPES as readonly string[]).includes(eventType)
}

export function isTreatmentEvent(eventType: EventType): boolean {
  return (TREATMENT_EVENT_TYPES as readonly string[]).includes(eventType)
}

export function entryHasTitle(event: Pick<EventRecord, "title">): boolean {
  return event.title.trim().length > 0
}

export function entryHasWhen(event: Pick<EventRecord, "startPrecision" | "startValue">): boolean {
  return Boolean(event.startPrecision && event.startValue.trim())
}

/**
 * Null when the entry has both a title and a when (date or age).
 * Significant-other entries are not dated in the report, so a missing start date is not a gap.
 * The client's own entries are dated from startPrecision and startValue, which is also what the report reads.
 */
export function entryDetailGap(event: EventRecord): "title" | "date" | "both" | null {
  const title = entryHasTitle(event)
  const when = entryHasWhen(event) || resolvedAbout(event) === "significant_other"
  if (title && when) return null
  if (!title && !when) return "both"
  return title ? "date" : "title"
}

export function entryDetailMessage(event: EventRecord, dateOfBirth: string | null): string | null {
  const gap = entryDetailGap(event)
  if (!gap) return null
  const label = HISTORY_QUESTIONS[historyQuestionKeyForEvent(event, dateOfBirth)].label
  const title = event.title.trim()
  if (gap === "both") return `${label}: entry needs detail (no title, no date)`
  if (gap === "title") return `${label}: entry needs detail (no title)`
  return `${label}: '${title}' entry needs detail (no date)`
}

export function treatmentsForCondition(events: EventRecord[], conditionId: string): EventRecord[] {
  return events.filter(
    (event) =>
      isTreatmentEvent(event.eventType) &&
      event.attribution === "self" &&
      event.conditionEventId === conditionId
  )
}

export function treatmentNeedsLink(event: EventRecord): boolean {
  return isTreatmentEvent(event.eventType) && event.attribution === "self" && !event.conditionEventId
}

export function unlinkedTreatmentMessage(event: EventRecord): string | null {
  if (!treatmentNeedsLink(event)) return null
  const label = HISTORY_QUESTIONS[historyQuestionKeyForEvent(event, null)].label
  const title = event.title.trim()
  return title ? `${label} '${title}' is not linked to a condition` : `${label} entry is not linked to a condition`
}
