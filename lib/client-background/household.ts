/**
 * Household helpers for living situation (Round AM).
 * Pure — no database.
 */

import {
  HOUSEHOLD_LABELS,
  HOUSEHOLD_OPTIONS,
  RELATIONSHIP_LIVING_SITUATIONS,
  type DependencyValue,
  type Household,
  type LivesWith,
  type OtherInHome,
  type RelationshipLivingSituation,
  type RelationshipRecord,
} from "@/lib/client-background/types"

/** Migration / backfill: map legacy livesWith pick-list → household. */
export function householdFromLivesWith(livesWith: LivesWith | "" | null | undefined): Household | "" {
  if (!livesWith) return ""
  if (livesWith === "alone") return "alone"
  if (livesWith === "no_fixed_address") return "no_fixed_address"
  return "with_others"
}

export function isHousehold(value: unknown): value is Household {
  return typeof value === "string" && (HOUSEHOLD_OPTIONS as readonly string[]).includes(value)
}

export function householdLabel(household: Household | ""): string {
  if (!household) return ""
  return HOUSEHOLD_LABELS[household]
}

/** Three-way living choice shown in the household editor. */
export type HouseholdLivingChoice = "full_time" | "part_time" | "no"

export function livingChoiceFromSituation(
  livingSituation: RelationshipLivingSituation | "" | null | undefined
): HouseholdLivingChoice | null {
  if (livingSituation === "lives_with_client_full_time") return "full_time"
  if (livingSituation === "lives_with_client_part_time") return "part_time"
  if (livingSituation === "does_not_live_with_client") return "no"
  return null
}

export function livingSituationFromChoice(
  choice: HouseholdLivingChoice
): RelationshipLivingSituation {
  if (choice === "full_time") return "lives_with_client_full_time"
  if (choice === "part_time") return "lives_with_client_part_time"
  return "does_not_live_with_client"
}

export function livingChoiceLabel(choice: HouseholdLivingChoice): string {
  if (choice === "full_time") return "full-time"
  if (choice === "part_time") return "part-time"
  return "no"
}

/**
 * Dependant tick ↔ dependency without losing i_depend_on_them detail.
 * Shown ticked when they_depend_on_me or mutual.
 */
export function dependantTickFromDependency(
  dependency: DependencyValue | "" | null | undefined
): boolean {
  return dependency === "they_depend_on_me" || dependency === "mutual"
}

export function dependencyAfterDependantTick(
  current: DependencyValue | "" | null | undefined,
  ticked: boolean
): DependencyValue {
  const value = current || "neither"
  if (ticked) {
    if (value === "neither") return "they_depend_on_me"
    if (value === "i_depend_on_them") return "mutual"
    if (value === "they_depend_on_me" || value === "mutual") return value
    return "they_depend_on_me"
  }
  if (value === "they_depend_on_me") return "neither"
  if (value === "mutual") return "i_depend_on_them"
  return value === "i_depend_on_them" || value === "neither" ? value : "neither"
}

const HOUSEHOLD_PERSON_ROLES = new Set<string>([
  "partner",
  "child",
  "parent",
  "caregiver",
  "sibling",
])

/** Living people from sections 5–6 (partners, children, parents, caregivers, siblings). */
export function householdPeopleFromRelationships(
  relationships: readonly RelationshipRecord[]
): RelationshipRecord[] {
  return relationships.filter(
    (person) => !person.deceased && HOUSEHOLD_PERSON_ROLES.has(person.blockRole ?? "")
  )
}

export function personLivesWithClient(person: RelationshipRecord): boolean {
  return (
    person.livingSituation === "lives_with_client_full_time" ||
    person.livingSituation === "lives_with_client_part_time"
  )
}

export function isRelationshipLivingSituation(
  value: unknown
): value is RelationshipLivingSituation {
  return (
    typeof value === "string" &&
    (RELATIONSHIP_LIVING_SITUATIONS as readonly string[]).includes(value)
  )
}

export function newOtherInHomeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `other-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyOtherInHome(): OtherInHome {
  return { id: newOtherInHomeId(), who: "", dependant: false }
}
