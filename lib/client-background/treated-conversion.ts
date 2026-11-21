import { isConditionEvent, isTreatmentEvent } from "@/lib/client-background/history-links"
import { SINGLE_EVENT_TYPES, type AdmissionType, type EventRecord, type EventType } from "@/lib/client-background/types"

export type TreatedConversionPlan = {
  /** New treatment events to insert (no eventRecordId yet). */
  treatments: Array<{
    sourceEventRecordId: string
    eventType: EventType
    title: string
    description: string
    admissionType: AdmissionType | ""
    startPrecision: EventRecord["startPrecision"]
    startValue: string
    conditionGroupId: string | null
    parentEventId: string | null
    about: EventRecord["about"]
    relationshipRecordId: string | null
    aboutOther: string
  }>
  /** Issues whose treatment_answer should become yes. */
  issueTreatmentYes: string[]
  /** Condition events with treated=false → set issue treatment_answer to none when blank. */
  issueTreatmentNone: string[]
}

function mentionsEmergency(detail: string): boolean {
  return /\b(emergency|ed)\b/i.test(detail)
}

function mapTreatmentType(treatmentType: string, treatmentDetail: string): {
  eventType: EventType
  title: string
  admissionType: AdmissionType | ""
} {
  const type = treatmentType.trim().toLowerCase()
  const detail = treatmentDetail.trim()
  if (type === "hospital" || type.includes("hospital") || type.includes("admission")) {
    return {
      eventType: "psychiatric_admission",
      title: "",
      admissionType: mentionsEmergency(detail) || mentionsEmergency(type) ? "emergency_department" : "",
    }
  }
  if (type === "psychology" || type.includes("psychology")) {
    return { eventType: "previous_therapy", title: "psychologist", admissionType: "" }
  }
  if (type === "therapy" || type.includes("therapy")) {
    return { eventType: "previous_therapy", title: "", admissionType: "" }
  }
  const title = treatmentType.trim() || "Other treatment"
  return { eventType: "other_treatment", title, admissionType: "" }
}

function buildDescription(treatmentDetail: string, outcome: string): string {
  return [treatmentDetail.trim(), outcome.trim()].filter(Boolean).join("\n\n")
}

function isSingleEvent(eventType: EventType): boolean {
  return (SINGLE_EVENT_TYPES as readonly string[]).includes(eventType)
}

/**
 * Plan conversion of legacy Treated fields into Treatment events.
 * Mirrors migration 0077 — used by self-tests; SQL applies the same rules.
 */
export function planTreatedFieldConversion(events: EventRecord[]): TreatedConversionPlan {
  const treatments: TreatedConversionPlan["treatments"] = []
  const issueTreatmentYes = new Set<string>()
  const issueTreatmentNone = new Set<string>()

  for (const event of events) {
    if (event.treated !== true && event.treated !== false) continue
    if (isTreatmentEvent(event.eventType)) continue

    if (event.treated === true) {
      const mapped = mapTreatmentType(event.treatmentType, event.treatmentDetail)
      const conditionGroupId =
        event.conditionGroupId && !event.conditionGroupId.startsWith("title:")
          ? event.conditionGroupId
          : isConditionEvent(event.eventType)
            ? event.conditionGroupId
            : null
      const parentEventId = isSingleEvent(event.eventType) ? event.eventRecordId : null
      // Prefer issue link for condition episodes; parent for single events.
      const linkIssue =
        isConditionEvent(event.eventType) && conditionGroupId && !conditionGroupId.startsWith("title:")
          ? conditionGroupId
          : null
      treatments.push({
        sourceEventRecordId: event.eventRecordId,
        eventType: mapped.eventType,
        title: mapped.title,
        description: buildDescription(event.treatmentDetail, event.outcome),
        admissionType: mapped.admissionType,
        startPrecision: event.startPrecision,
        startValue: event.startValue,
        conditionGroupId: linkIssue,
        parentEventId: linkIssue ? null : parentEventId,
        about: event.about,
        relationshipRecordId: event.relationshipRecordId,
        aboutOther: event.aboutOther,
      })
      if (linkIssue) issueTreatmentYes.add(linkIssue)
    } else if (event.treated === false && isConditionEvent(event.eventType)) {
      const issueId = event.conditionGroupId?.trim()
      if (issueId && !issueId.startsWith("title:")) issueTreatmentNone.add(issueId)
    }
  }

  // none only when no yes conversion also targets that issue
  for (const id of issueTreatmentYes) issueTreatmentNone.delete(id)

  return {
    treatments,
    issueTreatmentYes: [...issueTreatmentYes],
    issueTreatmentNone: [...issueTreatmentNone],
  }
}
