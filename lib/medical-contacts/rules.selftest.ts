import assert from "node:assert/strict"

import type { EventRecord } from "@/lib/client-background/types"
import { emptyEvent } from "@/lib/client-background/types"
import {
  MEDICAL_CONTACT_IN_USE_MESSAGE,
  formatMedicalContactLabel,
  formatMedicationSupervisedAnswer,
  formatSupervisesLine,
  medicalContactSupervisesHistoryMedication,
  resolveMainMedicalContact,
} from "@/lib/medical-contacts/rules"

function med(
  partial: Partial<EventRecord> & { eventRecordId: string; title: string }
): EventRecord {
  return {
    ...emptyEvent("medication", 0),
    about: "self",
    endOngoing: true,
    resolvedOrOngoing: "ongoing",
    ...partial,
  }
}

assert.equal(resolveMainMedicalContact([]), null)

const only = { id: "a", isMain: false }
assert.equal(resolveMainMedicalContact([only]), only)

const marked = { id: "b", isMain: true }
const other = { id: "c", isMain: false }
assert.equal(resolveMainMedicalContact([other, marked]), marked)
assert.equal(resolveMainMedicalContact([other, { id: "d", isMain: false }]), null)

const harry = {
  professionalId: "p1",
  title: "Dr",
  firstName: "Harry",
  lastName: "TestDoc",
  professionName: "GP",
}

assert.equal(formatMedicalContactLabel(harry), "Dr Harry TestDoc · GP")

const sertraline = med({
  eventRecordId: "e1",
  title: "Sertraline",
  prescriberProfessionalId: "p1",
})
assert.equal(formatSupervisesLine([sertraline], "p1"), "Sertraline (ongoing)")
assert.equal(formatSupervisesLine([sertraline], "p2"), "No current medication")

const ended = med({
  eventRecordId: "e2",
  title: "Old med",
  prescriberProfessionalId: "p1",
  endOngoing: false,
  resolvedOrOngoing: "resolved",
  endValue: "2020",
})
assert.equal(medicalContactSupervisesHistoryMedication([ended], "p1"), true)
assert.equal(medicalContactSupervisesHistoryMedication([ended], "p9"), false)
assert.equal(
  MEDICAL_CONTACT_IN_USE_MESSAGE,
  "Supervises a medication in History. Change the medication first."
)

const supervised = formatMedicationSupervisedAnswer([sertraline], [harry])
assert.equal(supervised.supervised, true)
assert.equal(supervised.line, "Yes, by Dr Harry TestDoc (GP)")
assert.equal(
  supervised.fullLine,
  "Medication supervised: Yes, by Dr Harry TestDoc (GP)"
)

const none = formatMedicationSupervisedAnswer([], [harry])
assert.equal(none.supervised, false)
assert.equal(none.line, "No")
assert.equal(none.fullLine, "Medication supervised: No")

console.log("medical-contacts/rules.selftest.ts: ok")
