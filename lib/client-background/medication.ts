import type { EventRecord } from "@/lib/client-background/types"
import type { MedicationSupervisionJson } from "@/lib/treatment-plans/types"

/** Ongoing medication entries are the live supervision record. */
export function ongoingMedicationEvents(events: EventRecord[]): EventRecord[] {
  return events.filter(
    (event) =>
      event.eventType === "medication" &&
      event.about !== "significant_other" &&
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
