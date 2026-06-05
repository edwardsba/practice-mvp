import {
  BECOMING_UNWELL_OPTIONS,
  CRISIS_RESPONSE_OPTIONS,
  DOING_WELL_OPTIONS,
  EMERGENCY_NUMBERS_OPTIONS,
  GET_BETTER_OPTIONS,
  STAY_WELL_OPTIONS,
  UNWELL_OPTIONS,
  optionLabel,
} from "@/lib/crisis-plans/fields"
import type {
  CrisisPlanRow,
  EmergencyContactRow,
  MultiSelectSectionJson,
} from "@/lib/crisis-plans/types"

export type CrisisPlanPdfData = {
  clientName: string
  dateOfPlan: string
  contacts: {
    role: string
    name: string
    phone: string
    email: string
  }[]
  emergencyNumbers: string[]
  doingWell: string[]
  stayWell: string[]
  becomingUnwell: string[]
  getBetter: string[]
  unwell: string[]
  crisisResponse: string[]
}

function formatPdfDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function sectionItems(
  options: { key: string; label: string }[],
  section: MultiSelectSectionJson
) {
  return [
    ...section.selected.map((key) => optionLabel(options, key)),
    ...section.other,
  ]
}

export function buildCrisisPlanPdfData(
  plan: CrisisPlanRow,
  contacts: EmergencyContactRow[],
  clientName: string
): CrisisPlanPdfData {
  const empty = { selected: [], other: [] }

  return {
    clientName,
    dateOfPlan: formatPdfDate(plan.dateOfPlan),
    contacts: contacts.map((contact) => ({
      role: contact.role ?? "",
      name: contact.name,
      phone: contact.phone ?? "",
      email: contact.email ?? "",
    })),
    emergencyNumbers: sectionItems(
      EMERGENCY_NUMBERS_OPTIONS,
      plan.emergencyNumbersJson ?? empty
    ),
    doingWell: sectionItems(DOING_WELL_OPTIONS, plan.doingWellJson ?? empty),
    stayWell: sectionItems(STAY_WELL_OPTIONS, plan.stayWellJson ?? empty),
    becomingUnwell: sectionItems(
      BECOMING_UNWELL_OPTIONS,
      plan.becomingUnwellJson ?? empty
    ),
    getBetter: sectionItems(GET_BETTER_OPTIONS, plan.getBetterJson ?? empty),
    unwell: sectionItems(UNWELL_OPTIONS, plan.unwellJson ?? empty),
    crisisResponse: sectionItems(
      CRISIS_RESPONSE_OPTIONS,
      plan.crisisResponseJson ?? empty
    ),
  }
}
