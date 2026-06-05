export type MultiSelectSectionJson = {
  selected: string[]
  other: string[]
}

export type EmergencyContactInput = {
  contactId?: string
  role: string
  name: string
  phone: string
  email: string
}

export type EmergencyContactRow = {
  contactId: string
  clientId: string
  practiceId: string
  role: string | null
  name: string
  phone: string | null
  email: string | null
  displayOrder: number
}

export type CrisisPlanFormValues = {
  dateOfPlan: string
  emergencyContacts: EmergencyContactInput[]
  emergencyNumbers: MultiSelectSectionJson
  doingWell: MultiSelectSectionJson
  stayWell: MultiSelectSectionJson
  becomingUnwell: MultiSelectSectionJson
  getBetter: MultiSelectSectionJson
  unwell: MultiSelectSectionJson
  crisisResponse: MultiSelectSectionJson
}

export type CrisisPlanRow = {
  crisisPlanId: string
  clientId: string
  practiceId: string
  practitionerProfileId: string
  versionNumber: number
  isActive: boolean
  dateOfPlan: string
  emergencyNumbersJson: MultiSelectSectionJson
  doingWellJson: MultiSelectSectionJson
  stayWellJson: MultiSelectSectionJson
  becomingUnwellJson: MultiSelectSectionJson
  getBetterJson: MultiSelectSectionJson
  unwellJson: MultiSelectSectionJson
  crisisResponseJson: MultiSelectSectionJson
  pdfStoragePath: string | null
  createdAt: Date
  updatedAt: Date
}
