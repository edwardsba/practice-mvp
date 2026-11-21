import {
  TREATMENT_EVENT_TYPES,
  type EventType,
  type SmartEventKind,
  type TreatmentTypeChoice,
} from "@/lib/client-background/types"

/** Fields shown for each smart-event kind (board AE). */
export type SmartField =
  | "started"
  | "ended"
  | "description"
  | "substance_status"
  | "abstinent_since"
  | "treatment_type"
  | "admission_type"
  | "facility"
  | "admission_length"
  | "therapy_provider"
  | "medication_name"
  | "prescriber"
  | "other_title"
  | "title"
  | "date"
  | "self_harm_type"

const EPISODE_FIELDS: SmartField[] = ["started", "ended", "description"]
const EPISODE_SUBSTANCE_FIELDS: SmartField[] = [
  "started",
  "ended",
  "description",
  "substance_status",
  "abstinent_since",
]
const TREATMENT_BASE: SmartField[] = ["treatment_type", "started", "ended", "description"]
const OTHER_FIELDS: SmartField[] = ["title", "date", "description"]

export function fieldsForSmartKind(
  kind: SmartEventKind,
  options?: { category?: EventType | null; treatmentType?: TreatmentTypeChoice | "" }
): SmartField[] {
  if (kind === "episode") {
    if (options?.category === "substance_use") return [...EPISODE_SUBSTANCE_FIELDS]
    if (options?.category === "self_harm") return ["self_harm_type", ...EPISODE_FIELDS]
    return [...EPISODE_FIELDS]
  }
  if (kind === "other") return [...OTHER_FIELDS]
  const treatmentType = options?.treatmentType || ""
  const fields: SmartField[] = ["treatment_type"]
  if (treatmentType === "hospital_admission") {
    fields.push("admission_type", "facility", "admission_length")
  } else if (treatmentType === "therapy") {
    fields.push("therapy_provider")
  } else if (treatmentType === "medication") {
    fields.push("medication_name", "prescriber")
  } else if (treatmentType === "other") {
    fields.push("other_title")
  }
  fields.push("started", "ended", "description")
  return fields
}

export function eventTypeForSmartKind(
  kind: SmartEventKind,
  options?: {
    category?: EventType | null
    treatmentType?: TreatmentTypeChoice | ""
  }
): EventType {
  if (kind === "other") return "other_event"
  if (kind === "episode") {
    const category = options?.category
    if (
      category === "emotional_problems" ||
      category === "substance_use" ||
      category === "illness_injury" ||
      category === "self_harm" ||
      category === "traumatic_event" ||
      category === "significant_history" ||
      category === "family_events"
    ) {
      return category
    }
    return "emotional_problems"
  }
  const treatmentType = options?.treatmentType || "hospital_admission"
  if (treatmentType === "therapy") return "previous_therapy"
  if (treatmentType === "medication") return "medication"
  if (treatmentType === "other") return "other_treatment"
  return "psychiatric_admission"
}

export function smartKindForEventType(eventType: EventType): SmartEventKind {
  if (eventType === "other_event") return "other"
  if ((TREATMENT_EVENT_TYPES as readonly string[]).includes(eventType)) return "treatment"
  return "episode"
}

export function treatmentTypeChoiceForEventType(eventType: EventType): TreatmentTypeChoice | "" {
  if (eventType === "psychiatric_admission") return "hospital_admission"
  if (eventType === "previous_therapy") return "therapy"
  if (eventType === "medication") return "medication"
  if (eventType === "other_treatment") return "other"
  return ""
}

/** Old Treated / Condition / For fields that must not appear on smart forms. */
export const RETIRED_HISTORY_FORM_FIELDS = [
  "condition",
  "for",
  "treated",
  "treatment_type_legacy",
  "treatment_detail",
  "outcome",
] as const
