import type { CheckboxOption } from "@/lib/crisis-plans/fields"
import {
  BECOMING_UNWELL_OPTIONS,
  CRISIS_RESPONSE_OPTIONS,
  DOING_WELL_OPTIONS,
  EMERGENCY_NUMBERS_OPTIONS,
  GET_BETTER_OPTIONS,
  STAY_WELL_OPTIONS,
  UNWELL_OPTIONS,
} from "@/lib/crisis-plans/fields"
import type {
  CrisisPlanFormValues,
  EmergencyContactInput,
  MultiSelectSectionJson,
} from "@/lib/crisis-plans/types"

function parseMultiSection(
  formData: FormData,
  prefix: string,
  options: CheckboxOption[],
  includeOther: boolean
): MultiSelectSectionJson {
  const selected = options
    .filter((option) => formData.get(`${prefix}_${option.key}`) === "on")
    .map((option) => option.key)

  const other = includeOther
    ? formData
        .getAll(`${prefix}_other`)
        .map((value) => String(value).trim())
        .filter(Boolean)
    : []

  return { selected, other }
}

function parseEmergencyContacts(formData: FormData): EmergencyContactInput[] {
  const raw = String(formData.get("emergency_contacts_json") ?? "").trim()
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as EmergencyContactInput[]
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((contact) => ({
        contactId: contact.contactId?.trim() || undefined,
        role: String(contact.role ?? "").trim(),
        name: String(contact.name ?? "").trim(),
        phone: String(contact.phone ?? "").trim(),
        email: String(contact.email ?? "").trim(),
      }))
      .filter((contact) => contact.name)
  } catch {
    return []
  }
}

export function parseCrisisPlanFormData(
  formData: FormData
): CrisisPlanFormValues {
  const dateOfPlan = String(formData.get("date_of_plan") ?? "").trim()
  if (!dateOfPlan) {
    throw new Error("Date of plan is required.")
  }

  return {
    dateOfPlan,
    emergencyContacts: parseEmergencyContacts(formData),
    emergencyNumbers: parseMultiSection(
      formData,
      "en",
      EMERGENCY_NUMBERS_OPTIONS,
      false
    ),
    doingWell: parseMultiSection(formData, "dw", DOING_WELL_OPTIONS, true),
    stayWell: parseMultiSection(formData, "sw", STAY_WELL_OPTIONS, true),
    becomingUnwell: parseMultiSection(
      formData,
      "bu",
      BECOMING_UNWELL_OPTIONS,
      true
    ),
    getBetter: parseMultiSection(formData, "gb", GET_BETTER_OPTIONS, true),
    unwell: parseMultiSection(formData, "uw", UNWELL_OPTIONS, true),
    crisisResponse: parseMultiSection(
      formData,
      "cr",
      CRISIS_RESPONSE_OPTIONS,
      true
    ),
  }
}

export function formValuesToDbColumns(values: CrisisPlanFormValues) {
  return {
    dateOfPlan: values.dateOfPlan,
    emergencyNumbersJson: values.emergencyNumbers,
    doingWellJson: values.doingWell,
    stayWellJson: values.stayWell,
    becomingUnwellJson: values.becomingUnwell,
    getBetterJson: values.getBetter,
    unwellJson: values.unwell,
    crisisResponseJson: values.crisisResponse,
  }
}
