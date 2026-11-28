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
  /** Section 7: household alone while people/others are marked living with the client. */
  householdAloneWithSomeoneLiving?: boolean
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

  // Sections 2 and 4 no longer have Yes/No answers (Round AR.1) — no contradictions there.
  // Tree sections 5, 6, 8, 9 keep theirs.

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

  if (input.householdAloneWithSomeoneLiving) {
    notes.push({
      itemKey: "s7_who",
      message: "Someone is recorded as living with the client.",
      target: "interview",
    })
  }

  return notes
}

/** True when household is alone but someone lives with the client (people or othersInHome). */
export function householdAloneContradiction(input: {
  household: string | null | undefined
  someoneLivesWithClient: boolean
  othersInHomeCount: number
}): boolean {
  if (input.household !== "alone") return false
  return input.someoneLivesWithClient || input.othersInHomeCount > 0
}
