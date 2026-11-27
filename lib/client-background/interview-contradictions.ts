/**
 * Contradiction notes: item answered No / Not applicable while matching
 * records are still on file. Pure — no database.
 */

export type ContradictionNote = {
  itemKey: string
  message: string
  /** Worth-checking style target for Complete jump. */
  target:
    | "interview"
    | "relationships"
    | "history"
    | "funding"
    | "emergency"
}

export type ContradictionInput = {
  answers: Record<string, { value: string } | undefined>
  medicareClaimExists: boolean
  ndisClaimCount: number
  insurerClaimCount: number
  emergencyContactCount: number
  gpCount: number
  otherProfessionalCount: number
  /** Item key → true when that history/relationship category has recorded entries. */
  historyHasEntries: Record<string, boolean>
  relationshipHasEntries: Record<string, boolean>
}

function isNegative(value: string | undefined): boolean {
  return value === "no" || value === "not_applicable"
}

/**
 * Build contradiction notes for interview items that deny records still on file.
 */
export function interviewContradictionNotes(input: ContradictionInput): ContradictionNote[] {
  const notes: ContradictionNote[] = []
  const a = input.answers

  if (isNegative(a.s2_medicare?.value) && input.medicareClaimExists) {
    notes.push({
      itemKey: "s2_medicare",
      message: "A Medicare claim is on file.",
      target: "funding",
    })
  }
  if (isNegative(a.s2_ndis?.value) && input.ndisClaimCount > 0) {
    notes.push({
      itemKey: "s2_ndis",
      message:
        input.ndisClaimCount === 1
          ? "An NDIS claim is on file. Check this answer."
          : `${input.ndisClaimCount} NDIS claims are on file. Check this answer.`,
      target: "funding",
    })
  }
  if (isNegative(a.s2_insurance?.value) && input.insurerClaimCount > 0) {
    notes.push({
      itemKey: "s2_insurance",
      message:
        input.insurerClaimCount === 1
          ? "An insurance or WorkCover claim is on file. Check this answer."
          : `${input.insurerClaimCount} insurance or WorkCover claims are on file. Check this answer.`,
      target: "funding",
    })
  }

  if (isNegative(a.s4_emergency?.value) && input.emergencyContactCount > 0) {
    const n = input.emergencyContactCount
    notes.push({
      itemKey: "s4_emergency",
      message: n === 1 ? "1 emergency contact is on file." : `${n} emergency contacts are on file.`,
      target: "emergency",
    })
  }
  if (isNegative(a.s4_gp?.value) && input.gpCount > 0) {
    notes.push({
      itemKey: "s4_gp",
      message: input.gpCount === 1 ? "A GP is on file." : `${input.gpCount} GPs are on file.`,
      target: "emergency",
    })
  }
  if (isNegative(a.s4_other_professionals?.value) && input.otherProfessionalCount > 0) {
    const n = input.otherProfessionalCount
    notes.push({
      itemKey: "s4_other_professionals",
      message:
        n === 1
          ? "A treating professional is on file."
          : `${n} treating professionals are on file.`,
      target: "emergency",
    })
  }

  const relationshipPairs: Array<[string, string]> = [
    ["s5_current", "Current relationship entries are on file."],
    ["s5_previous", "Previous relationship entries are on file."],
    ["s5_children", "Children entries are on file."],
    ["s6_mother_other", "Mother's other relationship entries are on file."],
    ["s6_father_other", "Father's other relationship entries are on file."],
    ["s6_caregiver", "Caregiver arrangement entries are on file."],
    ["s6_siblings", "Sibling entries are on file."],
  ]
  for (const [key, message] of relationshipPairs) {
    if (isNegative(a[key]?.value) && input.relationshipHasEntries[key]) {
      notes.push({ itemKey: key, message, target: "relationships" })
    }
  }

  for (const [key, has] of Object.entries(input.historyHasEntries)) {
    if (!has) continue
    if (!isNegative(a[key]?.value)) continue
    const label = key.startsWith("s8_") || key.startsWith("s9_")
      ? "Mental health entries are on file."
      : "History entries are on file."
    // Use category-specific wording where we can guess from key suffix
    let message = label
    if (key.includes("substance")) message = "Substance use entries are on file."
    else if (key.includes("illness") || key.includes("injury")) message = "Physical health entries are on file."
    else if (key.includes("self_harm")) message = "Self-harm entries are on file."
    else if (key.includes("traumatic")) message = "Traumatic event entries are on file."
    else if (key.includes("significant")) message = "Significant event entries are on file."
    else if (key.includes("treatment")) message = "Treatment entries are on file."
    else if (key.includes("emotional") || key.includes("mental")) {
      message = "Mental health entries are on file."
    }
    notes.push({
      itemKey: key,
      message,
      target: "history",
    })
  }

  return notes
}
