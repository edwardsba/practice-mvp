import type { MedicationRecord } from "@/lib/client-background/types"
import type { MedicationSupervisionJson } from "@/lib/treatment-plans/types"

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
