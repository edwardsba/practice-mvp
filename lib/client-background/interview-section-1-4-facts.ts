/**
 * Fact lines for interview sections 1, 2 and 4 (Round AL).
 * Pure — no database.
 */

import { formatCommunicationPreferenceLines } from "@/lib/clients/communication-summary"
import type { CommunicationPreferencesInput } from "@/lib/clients/communication-summary"
import { formatAustralianPhone } from "@/lib/format/phone"
import {
  formatDisplayDate,
  formatMedicareCardDisplay,
  formatMedicareExpiry,
  isInsurerClaim,
  isMedicareClaim,
  isNdisClaim,
} from "@/lib/funding/format"

export function formatDobWithAge(dateOfBirth: string | null | undefined, ageLabel: string): string {
  const dob = dateOfBirth?.trim()
  if (!dob) return "Not recorded"
  if (ageLabel.trim()) return `${dob} (age ${ageLabel.trim()})`
  return dob
}

export function section1FactLines(input: {
  preferredName: string | null | undefined
  dateOfBirth: string | null | undefined
  ageLabel: string
  phone: string | null | undefined
  email: string | null | undefined
  address: string | null | undefined
  comms: CommunicationPreferencesInput
  clientDisplayName: string
}): Record<string, string[]> {
  const preferred = input.preferredName?.trim()
  const phone = formatAustralianPhone(input.phone) || "Not recorded"
  const email = input.email?.trim() || "Not recorded"
  const address = input.address?.trim() || "Not recorded"
  return {
    s1_name: [input.clientDisplayName.trim() || "Not recorded"],
    s1_preferred_name: [preferred || "Not recorded"],
    s1_dob: [formatDobWithAge(input.dateOfBirth, input.ageLabel)],
    s1_phone: [phone],
    s1_email: [email],
    s1_address: [address],
    s1_comms: formatCommunicationPreferenceLines(input.comms),
  }
}

export type InterviewClaimFactInput = {
  claimId: string
  claimTypeName: string
  claimTypeCode: string | null
  medicareCardNumber?: string | null
  medicareIrn?: string | null
  medicareExpiry?: string | null
  insuranceOrganisationName?: string | null
  insuranceReferenceNumber?: string | null
  startDate?: string | null
  endDate?: string | null
  approvals: Array<{
    name: string
    appointmentsAttended: number
    appointmentsApproved: number | null
    approvalStatus: string
  }>
}

/** Claim-only facts (no funding approval lines). Empty when nothing on file. */
export function medicareFactLines(claim: InterviewClaimFactInput | null): string[] {
  if (!claim) return []
  const card = formatMedicareCardDisplay(claim.medicareCardNumber, claim.medicareIrn)
  const expiry = formatMedicareExpiry(claim.medicareExpiry)
  const lines: string[] = ["Medicare"]
  if (card) lines.push(card)
  if (expiry) lines.push(`Expiry: ${expiry}`)
  const dates = [formatDisplayDate(claim.startDate), formatDisplayDate(claim.endDate)]
    .filter((part) => part !== "—")
    .join(" – ")
  if (dates) lines.push(dates)
  return lines
}

/** Claim-only facts for NDIS or insurer groups. Empty when none on file. */
export function claimGroupFactLines(
  claims: InterviewClaimFactInput[],
  kind: "ndis" | "insurer"
): string[] {
  const matching = claims.filter((claim) =>
    kind === "ndis" ? isNdisClaim(claim.claimTypeCode) : isInsurerClaim(claim.claimTypeCode)
  )
  if (matching.length === 0) return []
  const lines: string[] = []
  for (const claim of matching) {
    const bits = [claim.claimTypeName]
    if (claim.insuranceOrganisationName?.trim()) bits.push(claim.insuranceOrganisationName.trim())
    if (claim.insuranceReferenceNumber?.trim()) bits.push(`Ref ${claim.insuranceReferenceNumber.trim()}`)
    const dates = [formatDisplayDate(claim.startDate), formatDisplayDate(claim.endDate)]
      .filter((part) => part !== "—")
      .join(" – ")
    lines.push(dates ? `${bits.join(" · ")} (${dates})` : bits.join(" · "))
  }
  return lines
}

export function pickMedicareClaim(claims: InterviewClaimFactInput[]): InterviewClaimFactInput | null {
  return claims.find((claim) => isMedicareClaim(claim.claimTypeCode)) ?? null
}

export function emergencyContactFactLines(contact: {
  name: string
  role: string | null
  phone: string | null
  email: string | null
}): string[] {
  const lines = [contact.name.trim() || "Unnamed"]
  if (contact.role?.trim()) lines.push(`Role: ${contact.role.trim()}`)
  lines.push(`Phone: ${formatAustralianPhone(contact.phone) || "Not recorded"}`)
  lines.push(`Email: ${contact.email?.trim() || "Not recorded"}`)
  return lines
}

export function medicalContactFactLines(contact: {
  name: string
  organisationName: string | null
  phone: string | null
  isMain: boolean
}): string[] {
  const lines = [contact.name.trim() || "Unnamed"]
  if (contact.organisationName?.trim()) lines.push(contact.organisationName.trim())
  lines.push(`Phone: ${formatAustralianPhone(contact.phone) || "Not recorded"}`)
  if (contact.isMain) lines.push("Main")
  return lines
}

export function isGpProfession(professionName: string | null | undefined): boolean {
  return professionName?.trim() === "GP"
}
