import type {
  FamilyOfOriginRosterInput,
  PartnersChildrenRosterInput,
  RelationshipRecord,
} from "@/lib/intake-interview/types"

const SMALL_NUMBERS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
]

export function numberWord(value: number): string {
  if (Number.isInteger(value) && value >= 0 && value < SMALL_NUMBERS.length) {
    return SMALL_NUMBERS[value]
  }
  return String(value)
}

function countedNoun(count: number, singular: string, plural: string): string {
  return `${numberWord(count)} ${count === 1 ? singular : plural}`
}

function joinList(parts: string[]): string {
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`
}

function countOrZero(value: number | null): number {
  if (value == null || Number.isNaN(value) || value < 0) return 0
  return Math.floor(value)
}

export function summariseFamilyOfOrigin(
  roster: FamilyOfOriginRosterInput
): string {
  const full = countOrZero(roster.fullSiblingCount)
  const half = countOrZero(roster.halfSiblingCount)
  const step = countOrZero(roster.stepSiblingCount)
  const siblingTotal = full + half + step
  const sibshipSize = siblingTotal + 1

  if (siblingTotal === 0 || roster.clientBirthOrder === "only") {
    return "You were an only child."
  }

  const mixParts: string[] = []
  if (full > 0) mixParts.push(countedNoun(full, "full sibling", "full siblings"))
  if (half > 0) mixParts.push(countedNoun(half, "half-sibling", "half-siblings"))
  if (step > 0) mixParts.push(countedNoun(step, "step-sibling", "step-siblings"))
  const mix = joinList(mixParts)

  const ofSiblings = countedNoun(sibshipSize, "sibling", "siblings")

  if (roster.clientBirthOrder === "eldest") {
    return mixParts.length > 1
      ? `You were the eldest of ${ofSiblings} (${mix}).`
      : `You were the eldest of ${ofSiblings}.`
  }
  if (roster.clientBirthOrder === "youngest") {
    return mixParts.length > 1
      ? `You were the youngest of ${ofSiblings} (${mix}).`
      : `You were the youngest of ${ofSiblings}.`
  }
  if (roster.clientBirthOrder === "middle") {
    return mixParts.length > 1
      ? `You were a middle child of ${ofSiblings} (${mix}).`
      : `You were a middle child of ${ofSiblings}.`
  }

  return `You have ${mix}.`
}

export function summarisePartnersAndChildren(
  roster: PartnersChildrenRosterInput,
  relationships: RelationshipRecord[]
): string {
  const current = countOrZero(roster.currentPartnerCount)
  const prior = countOrZero(roster.priorPartnerCount)
  const children = relationships.filter(
    (record) =>
      record.relationshipToClient === "child_biological" ||
      record.relationshipToClient === "child_step"
  ).length

  const parts: string[] = []

  if (current === 0 && prior === 0) {
    parts.push("no current or prior partners")
  } else {
    if (current === 0) {
      parts.push("no current partner")
    } else if (current === 1) {
      parts.push("a current partner")
    } else {
      parts.push(`${numberWord(current)} current partners`)
    }

    if (prior === 0) {
      parts.push("no prior partners")
    } else {
      parts.push(countedNoun(prior, "prior partner", "prior partners"))
    }
  }

  if (children === 0) {
    parts.push("no children")
  } else {
    parts.push(countedNoun(children, "child", "children"))
  }

  const body = joinList(parts)
  return `You have ${body}.`
}
