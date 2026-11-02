import type { EventRecord, MedicationRecord } from "@/lib/client-background/types"
import type { MedicationSupervisionJson } from "@/lib/treatment-plans/types"

/** Ongoing medication entries are the live supervision record. */
export function ongoingMedicationEvents(events: EventRecord[]): EventRecord[] {
  return events.filter(
    (event) =>
      event.eventType === "medication" &&
      event.attribution === "self" &&
      (event.endOngoing || event.resolvedOrOngoing === "ongoing")
  )
}

/** Plan snapshot from the supervisors chosen for ongoing medication entries. */
export function medicationSupervisionFromAssignments(
  assignments: { professionalId: string | null }[],
  labelFor: (professionalId: string) => string | null
): MedicationSupervisionJson {
  const names = [
    ...new Set(
      assignments
        .map((item) => (item.professionalId ? labelFor(item.professionalId) : null))
        .filter((name): name is string => Boolean(name))
    ),
  ]
  if (names.length === 0) return { supervised: false, supervisorName: null }
  return { supervised: true, supervisorName: names.join("; ") }
}

/** Prefill for a treatment-plan draft. Ticked only when medication is current and a supervisor is named. */
export function medicationSupervisionFromRecord(medication: MedicationRecord): MedicationSupervisionJson {
  const name = medication.supervisedBy.trim()
  if (medication.currentlyTaking === "yes" && name) {
    return { supervised: true, supervisorName: name }
  }
  return { supervised: false, supervisorName: null }
}

/**
 * Central medication record after a plan is saved.
 * Ticked writes currently taking and the supervisor name.
 * Unticked clears the supervisor and leaves currently taking as it is.
 */
export function medicationAfterPlanSave(
  current: MedicationRecord,
  supervision: MedicationSupervisionJson
): MedicationRecord {
  if (supervision.supervised) {
    return {
      ...current,
      currentlyTaking: "yes",
      supervisedBy: (supervision.supervisorName ?? "").trim(),
    }
  }
  return { ...current, supervisedBy: "" }
}
