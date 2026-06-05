import type {
  CrisisPlanRow,
  EmergencyContactRow,
  MultiSelectSectionJson,
} from "@/lib/crisis-plans/types"

function parseMultiSection(value: unknown): MultiSelectSectionJson {
  if (!value || typeof value !== "object") {
    return { selected: [], other: [] }
  }
  const data = value as MultiSelectSectionJson
  return {
    selected: Array.isArray(data.selected)
      ? data.selected.map((item) => String(item))
      : [],
    other: Array.isArray(data.other)
      ? data.other.map((item) => String(item).trim()).filter(Boolean)
      : [],
  }
}

export function rowToCrisisPlan(row: {
  crisisPlanId: string
  clientId: string
  practiceId: string
  practitionerProfileId: string
  versionNumber: number
  isActive: boolean
  dateOfPlan: string
  emergencyNumbersJson: unknown
  doingWellJson: unknown
  stayWellJson: unknown
  becomingUnwellJson: unknown
  getBetterJson: unknown
  unwellJson: unknown
  crisisResponseJson: unknown
  pdfStoragePath: string | null
  createdAt: Date
  updatedAt: Date
}): CrisisPlanRow {
  return {
    crisisPlanId: row.crisisPlanId,
    clientId: row.clientId,
    practiceId: row.practiceId,
    practitionerProfileId: row.practitionerProfileId,
    versionNumber: row.versionNumber,
    isActive: row.isActive,
    dateOfPlan: row.dateOfPlan,
    emergencyNumbersJson: parseMultiSection(row.emergencyNumbersJson),
    doingWellJson: parseMultiSection(row.doingWellJson),
    stayWellJson: parseMultiSection(row.stayWellJson),
    becomingUnwellJson: parseMultiSection(row.becomingUnwellJson),
    getBetterJson: parseMultiSection(row.getBetterJson),
    unwellJson: parseMultiSection(row.unwellJson),
    crisisResponseJson: parseMultiSection(row.crisisResponseJson),
    pdfStoragePath: row.pdfStoragePath,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function formatDateForInput(value: string | null): string {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

export function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10)
}

export function rowToEmergencyContact(row: {
  contactId: string
  clientId: string
  practiceId: string
  role: string | null
  name: string
  phone: string | null
  email: string | null
  displayOrder: number
}): EmergencyContactRow {
  return {
    contactId: row.contactId,
    clientId: row.clientId,
    practiceId: row.practiceId,
    role: row.role,
    name: row.name,
    phone: row.phone,
    email: row.email,
    displayOrder: row.displayOrder,
  }
}
