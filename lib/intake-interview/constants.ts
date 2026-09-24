import type {
  EventCategory,
  EventSubDomain,
  RelationshipToClient,
} from "@/lib/intake-interview/types"

export const SELECT_CLASS_NAME =
  "flex h-9 w-full max-w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"

export const RELATIONSHIP_TO_CLIENT_LABELS: Record<RelationshipToClient, string> =
  {
    parent: "Parent",
    step_parent: "Step-parent",
    sibling_full: "Full sibling",
    sibling_half: "Half-sibling",
    sibling_step: "Step-sibling",
    current_partner: "Current partner",
    prior_partner: "Prior partner",
    child_biological: "Biological child",
    child_step: "Step-child",
  }

export const DEPENDENCY_LABELS = {
  neither: "Neither depends on the other",
  they_depend_on_me: "They depend on the client",
  i_depend_on_them: "The client depends on them",
  mutual: "Mutual",
} as const

export const PARENTS_MARITAL_STATUS_LABELS = {
  together: "Together",
  separated: "Separated",
  divorced: "Divorced",
  remarried: "Remarried",
  widowed: "Widowed",
  other: "Other",
} as const

export const CLIENT_BIRTH_ORDER_LABELS = {
  eldest: "Eldest",
  middle: "Middle",
  youngest: "Youngest",
  only: "Only child",
  other: "Other",
} as const

export const EVENT_SUB_DOMAIN_LABELS: Record<EventSubDomain, string> = {
  major_events: "Major events",
  illness_injury: "Illness or injury",
  emotional_problems: "Emotional problems",
  psychiatric_treatment: "Psychiatric treatment",
  history_of_abuse: "History of abuse",
  drugs_or_alcohol: "Drugs or alcohol",
}

const CHILDHOOD_GATING: Record<
  Exclude<EventSubDomain, "drugs_or_alcohol">,
  string
> = {
  major_events: "Have you experienced any major events in childhood?",
  illness_injury:
    "Have you experienced any significant illness or injury in childhood?",
  emotional_problems: "Have you experienced any emotional problems in childhood?",
  psychiatric_treatment:
    "Have you received any psychiatric treatment in childhood?",
  history_of_abuse: "Have you experienced any abuse in childhood?",
}

const ADULTHOOD_GATING: Record<EventSubDomain, string> = {
  major_events: "Have you experienced any major events in adulthood?",
  illness_injury:
    "Have you experienced any significant illness or injury in adulthood?",
  emotional_problems: "Have you experienced any emotional problems in adulthood?",
  psychiatric_treatment:
    "Have you received any psychiatric treatment in adulthood?",
  history_of_abuse: "Have you experienced any abuse in adulthood?",
  drugs_or_alcohol:
    "Have you used drugs or alcohol in a way that is clinically relevant to track (past use, periods of sobriety)?",
}

export function gatingQuestionFor(
  category: EventCategory,
  subDomain: EventSubDomain,
  personLabel?: string
): string {
  if (category === "family") {
    const who = personLabel?.trim() || "this family member"
    const family: Record<EventSubDomain, string> = {
      major_events: `Has ${who} experienced any major events?`,
      illness_injury: `Has ${who} experienced any significant illness or injury?`,
      emotional_problems: `Has ${who} experienced any emotional problems?`,
      psychiatric_treatment: `Has ${who} received any psychiatric treatment?`,
      history_of_abuse: `Has ${who} experienced any abuse?`,
      drugs_or_alcohol: `Has ${who} had any clinically relevant drug or alcohol use (past use, periods of sobriety)?`,
    }
    return family[subDomain]
  }
  if (category === "childhood") {
    if (subDomain === "drugs_or_alcohol") {
      return "Have you used drugs or alcohol in childhood in a way that is clinically relevant to track?"
    }
    return CHILDHOOD_GATING[subDomain]
  }
  return ADULTHOOD_GATING[subDomain]
}

export const NECESSITY_KEYS = [
  "food",
  "prescriptions",
  "transport",
  "leisure",
  "phoneInternet",
] as const

export const NECESSITY_LABELS: Record<(typeof NECESSITY_KEYS)[number], string> = {
  food: "Food",
  prescriptions: "Prescriptions",
  transport: "Transport",
  leisure: "Leisure",
  phoneInternet: "Phone / internet",
}

export const SEX_OPTIONS = ["Female", "Male", "Another term", "Prefer not to say"]
export const PRONOUN_OPTIONS = ["she/her", "he/him", "they/them"]
export const EDUCATION_LEVEL_OPTIONS = [
  "Did not complete secondary",
  "Secondary",
  "Certificate / diploma",
  "Bachelor degree",
  "Postgraduate",
  "Other",
]
export const HOUSING_TYPE_OPTIONS = [
  "Owner-occupied",
  "Private rental",
  "Social / community housing",
  "Living with family",
  "Shared housing",
  "Temporary / unstable",
  "Other",
]
export const HOUSING_STABILITY_OPTIONS = [
  "Stable",
  "Some concern",
  "Unstable",
]
