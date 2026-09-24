import type {
  EventCategory,
  EventRecord,
  EventSubDomain,
  IntakeInterviewPayload,
} from "@/lib/intake-interview/types"
import { applyRelationshipVisibilityDefaults } from "@/lib/intake-interview/visibility"

function isFilledJobTitle(title: string): boolean {
  return title.trim().length > 0
}

export function pruneEmptyDynamicItems<T>(
  items: T[],
  isEmpty: (item: T) => boolean
): T[] {
  return items.filter((item) => !isEmpty(item))
}

export function ensureEventRecords(params: {
  events: EventRecord[]
  category: EventCategory
  subDomains: readonly EventSubDomain[]
  personKind: EventRecord["personKind"]
  relationshipRecordId: string | null
}): EventRecord[] {
  const { events, category, subDomains, personKind, relationshipRecordId } =
    params
  const next = [...events]
  subDomains.forEach((subDomain, index) => {
    const exists = next.some(
      (event) =>
        event.eventCategory === category &&
        event.subDomain === subDomain &&
        event.personKind === personKind &&
        (event.relationshipRecordId ?? null) === relationshipRecordId
    )
    if (!exists) {
      next.push({
        eventRecordId: crypto.randomUUID(),
        eventCategory: category,
        subDomain,
        personKind,
        relationshipRecordId,
        endorsed: false,
        reasonDescription: "",
        ageDateStart: "",
        ageDateEnd: "",
        resolvedOrOngoing: "",
        severityImpact: "",
        treated: null,
        treatmentType: "",
        treatmentDetail: "",
        outcome: "",
        displayOrder: index,
      })
    }
  })
  return next
}

export function sanitizePayload(
  payload: IntakeInterviewPayload
): IntakeInterviewPayload {
  const relationshipIds = new Set(
    payload.relationships.map((record) => record.relationshipRecordId)
  )

  const relationships = payload.relationships.map(
    applyRelationshipVisibilityDefaults
  )

  const selectedRelationshipIds =
    payload.familyHistory.selectedRelationshipIds.filter((id) =>
      relationshipIds.has(id)
    )

  const events = payload.events.filter((event) => {
    if (event.personKind === "self") return true
    return (
      event.relationshipRecordId != null &&
      relationshipIds.has(event.relationshipRecordId)
    )
  })

  return {
    ...payload,
    interviewDate: payload.interviewDate.trim(),
    relationships,
    familyHistory: { selectedRelationshipIds },
    events,
    education: {
      ...payload.education,
      educationalEvents: pruneEmptyDynamicItems(
        payload.education.educationalEvents,
        (item) => !item.description.trim()
      ),
    },
    occupation: {
      currentJob: payload.occupation.currentJob,
      previousJobs: pruneEmptyDynamicItems(
        payload.occupation.previousJobs,
        (job) => !isFilledJobTitle(job.title)
      ),
    },
    socialSupport: {
      ...payload.socialSupport,
      groups: pruneEmptyDynamicItems(
        payload.socialSupport.groups,
        (group) => !group.name.trim()
      ),
    },
  }
}
