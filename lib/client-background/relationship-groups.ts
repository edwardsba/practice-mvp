import {
  personName,
  stepParentLinkLabel,
  type PartnerNode,
  type RelationshipTree,
  type StepParentLink,
} from "@/lib/client-background/tree"
import type { RelationshipRecord } from "@/lib/client-background/types"

/** Headings shared by the background interview and the Client Background page. */
export const RELATIONSHIP_GROUP_LABELS = {
  partnersAndChildren: "Partners and children",
  currentPartner: "Current partner",
  priorPartners: "Prior partners",
  children: "Children",
  familyOfOrigin: "Family of origin",
  parents: "Parents",
  siblings: "Siblings",
  stepFamily: "Step-family",
  needsLinking: "Needs linking",
  parentsRelationship: "Parents' relationship",
  unlinkedChildren: "Not linked to a listed partner",
  none: "None",
} as const

export const RELATIONSHIP_ADD_LABELS = {
  relationship: "+ Add relationship",
  partner: "+ Add partner",
  priorPartner: "+ Add prior partner",
  child: "+ Add child",
  parent: "+ Add parent",
  caregiver: "+ Add other primary caregiver",
  sibling: "+ Add sibling",
  stepSibling: "+ Add half- or step-sibling",
  stepParent: "+ Add step-parent",
} as const

export function splitPartnerNodes(partners: PartnerNode[]) {
  return {
    current: partners.filter((item) => item.person.relationshipToClient === "current_partner"),
    prior: partners.filter((item) => item.person.relationshipToClient === "prior_partner"),
  }
}

/** Partners who already have at least one child, in the tree's partner order. */
export function childrenByPartner(tree: RelationshipTree) {
  return tree.partners.filter((partner) => partner.children.length > 0)
}

/** Biological children, then step-children, who are not linked to a listed partner. */
export function childrenNotLinkedToPartner(tree: RelationshipTree) {
  return [...tree.unlinkedChildren, ...tree.unlinkedStepChildren]
}

export function needsLinkingItems(tree: RelationshipTree) {
  return [
    ...tree.unlinkedStepParents.map((person) => ({ person, action: "Choose parent ›" })),
    ...tree.unlinkedStepSiblings.map((person) => ({ person, action: "Choose step-parent ›" })),
    ...tree.unlinkedStepChildren.map((person) => ({ person, action: "Choose partner ›" })),
  ]
}

export function withPartnerHeading(person: Pick<RelationshipRecord, "givenName" | "relationshipToClient">) {
  return `With ${personName(person)}`
}

export function parentPartnersHeading(person: Pick<RelationshipRecord, "givenName" | "relationshipToClient">) {
  return `${personName(person)}'s partners`
}

export function stepParentRowLabel(link: StepParentLink) {
  return `Step-parent – ${stepParentLinkLabel(link)}`
}
