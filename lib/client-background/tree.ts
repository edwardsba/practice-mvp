import { assessAge, displayedAge } from "@/lib/client-background/age"
import { parsePartialDate } from "@/lib/client-background/partial-date"
import {
  ORIGIN_PARENT_ROLES,
  PARTNERSHIP_STATUS_LABELS,
  RELATIONSHIP_TO_CLIENT_LABELS,
  type PartnershipRecord,
  type RelationshipRecord,
  type RelationshipToClient,
} from "@/lib/client-background/types"
import { todayDateString } from "@/lib/dates/practice-time"

export type StepParentNode = {
  person: RelationshipRecord
  partnership: PartnershipRecord
  siblings: RelationshipRecord[]
}

export type OtherFamilyGroup = {
  parent: RelationshipRecord
  stepParents: StepParentNode[]
}

export type PartnerNode = {
  person: RelationshipRecord
  children: RelationshipRecord[]
}

export type RelationshipTree = {
  originParents: RelationshipRecord[]
  /** Other primary caregivers, shown in Family of Origin after the parents' relationship. */
  otherCaregivers: RelationshipRecord[]
  fullSiblings: RelationshipRecord[]
  otherFamily: OtherFamilyGroup[]
  unlinkedStepParents: RelationshipRecord[]
  unlinkedStepSiblings: RelationshipRecord[]
  partners: PartnerNode[]
  /** Biological children with no partner. A valid state, kept under "Children not linked to a listed partner". */
  unlinkedChildren: RelationshipRecord[]
  /** Step-children with no partner. They need a partner before they can sit in the tree. */
  unlinkedStepChildren: RelationshipRecord[]
}

export type FamilyOfOriginEntry =
  | { kind: "person"; id: string }
  | { kind: "parents-relationship" }

export type StepParentLink = {
  partnershipRecordId: string
  stepParent: RelationshipRecord
  parent: RelationshipRecord
}

export type MoveTarget = {
  id: string
  label: string
}

export type BrokenLinks = {
  kind: "siblings" | "children" | "step-parents"
  people: RelationshipRecord[]
  targets: MoveTarget[]
}

const ORIGIN = new Set<RelationshipToClient>(ORIGIN_PARENT_ROLES)
const PARTNERS = new Set<RelationshipToClient>(["current_partner", "prior_partner"])
const CHILDREN = new Set<RelationshipToClient>(["child_biological", "child_step"])
const NESTED_SIBLINGS = new Set<RelationshipToClient>(["sibling_half", "sibling_step"])

function byOrder(a: RelationshipRecord, b: RelationshipRecord): number {
  return a.displayOrder - b.displayOrder || a.givenName.localeCompare(b.givenName)
}

function originRank(role: RelationshipToClient): number {
  if (role === "mother") return 0
  if (role === "father") return 1
  return 2
}

export function personRoleLabel(record: Pick<RelationshipRecord, "relationshipToClient">): string {
  return RELATIONSHIP_TO_CLIENT_LABELS[record.relationshipToClient]
}

function treeAgeToken(
  person: Pick<RelationshipRecord, "dateOfBirth" | "healthStatus">,
  asOf: string
): string | null {
  if (person.healthStatus === "deceased") return null
  const age = assessAge(parsePartialDate(person.dateOfBirth), parsePartialDate(asOf), "person")
  const label = displayedAge(age)
  return label && age.kind !== "before_birth" ? label : null
}

export function relationshipLineLabel(
  person: Pick<
    RelationshipRecord,
    "relationshipToClient" | "givenName" | "dateOfBirth" | "healthStatus" | "caregiverRelationship"
  >,
  status?: string | null,
  asOf = todayDateString()
): string {
  if (person.relationshipToClient === "other_caregiver") {
    const name = person.givenName.trim()
    const relation = person.caregiverRelationship.trim()
    let label = name ? `Other primary caregiver – ${name}` : "Other primary caregiver"
    if (relation) label += ` (${relation})`
    const age = treeAgeToken(person, asOf)
    if (age) label += ` – ${age}`
    const statusText = status?.trim()
    if (statusText) label += ` – ${statusText}`
    return label
  }

  const parts = [personRoleLabel(person)]
  const name = person.givenName.trim()
  if (name) parts.push(name)
  const age = treeAgeToken(person, asOf)
  if (age) parts.push(age)
  const statusText = status?.trim()
  if (statusText) parts.push(statusText)
  return parts.join(" – ")
}

export function parentsRelationshipLabel(partnership: Pick<PartnershipRecord, "relationshipStatus">): string {
  const status = partnership.relationshipStatus
    ? PARTNERSHIP_STATUS_LABELS[partnership.relationshipStatus]
    : ""
  return status ? `Parents' relationship – ${status}` : "Parents' relationship"
}

/** Status shown on a tree row. Quality of relationship is never included. */
export function treeLineStatus(
  person: RelationshipRecord,
  partnerships: PartnershipRecord[]
): string | null {
  if (person.relationshipToClient === "step_parent") {
    const partnership = partnerships.find(
      (item) => item.partnerAId === person.relationshipRecordId || item.partnerBId === person.relationshipRecordId
    )
    return partnership?.relationshipStatus ? PARTNERSHIP_STATUS_LABELS[partnership.relationshipStatus] : null
  }
  if (person.relationshipToClient === "current_partner" || person.relationshipToClient === "prior_partner") {
    return person.relationshipStatus.trim() || null
  }
  return null
}

export function canonicalParentsLink(
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): {
  mother: RelationshipRecord | null
  father: RelationshipRecord | null
  partnership: PartnershipRecord | null
} {
  const mothers = people
    .filter((person) => person.relationshipToClient === "mother")
    .sort(byOrder)
  const fathers = people
    .filter((person) => person.relationshipToClient === "father")
    .sort(byOrder)
  const mother = mothers[0] ?? null
  const father = fathers[0] ?? null
  if (!mother || !father) return { mother, father, partnership: null }
  const partnership =
    partnerships.find(
      (item) =>
        (item.partnerAId === mother.relationshipRecordId && item.partnerBId === father.relationshipRecordId) ||
        (item.partnerBId === mother.relationshipRecordId && item.partnerAId === father.relationshipRecordId)
    ) ?? null
  return { mother, father, partnership }
}

export function personName(record: Pick<RelationshipRecord, "givenName" | "relationshipToClient">): string {
  const name = record.givenName.trim()
  return name || personRoleLabel(record)
}

export function otherPersonInPartnership(
  partnership: PartnershipRecord,
  personId: string,
  people: RelationshipRecord[]
): RelationshipRecord | undefined {
  const otherId = partnership.partnerAId === personId ? partnership.partnerBId : partnership.partnerAId
  return people.find((person) => person.relationshipRecordId === otherId)
}

export function partnershipsForPerson(
  personId: string,
  partnerships: PartnershipRecord[]
): PartnershipRecord[] {
  return partnerships.filter(
    (partnership) => partnership.partnerAId === personId || partnership.partnerBId === personId
  )
}

export function originPartnerships(
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): PartnershipRecord[] {
  const originIds = new Set(
    people
      .filter((person) => ORIGIN.has(person.relationshipToClient))
      .map((person) => person.relationshipRecordId)
  )
  return partnerships.filter(
    (partnership) => originIds.has(partnership.partnerAId) && originIds.has(partnership.partnerBId)
  )
}

export function buildRelationshipTree(
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): RelationshipTree {
  const byId = new Map(people.map((person) => [person.relationshipRecordId, person]))
  const originParents = people
    .filter((person) => ORIGIN.has(person.relationshipToClient))
    .sort((a, b) => originRank(a.relationshipToClient) - originRank(b.relationshipToClient) || byOrder(a, b))

  const otherCaregivers = people
    .filter((person) => person.relationshipToClient === "other_caregiver")
    .sort(byOrder)

  const fullSiblings = people
    .filter((person) => person.relationshipToClient === "sibling_full")
    .sort(byOrder)

  const otherFamily = originParents
    .map((parent) => {
      const stepParents = partnerships
        .flatMap((partnership) => {
          const otherId =
            partnership.partnerAId === parent.relationshipRecordId
              ? partnership.partnerBId
              : partnership.partnerBId === parent.relationshipRecordId
                ? partnership.partnerAId
                : null
          if (!otherId) return []
          const other = byId.get(otherId)
          if (!other || other.relationshipToClient !== "step_parent") return []
          const siblings = people
            .filter(
              (person) =>
                NESTED_SIBLINGS.has(person.relationshipToClient) &&
                person.partnershipRecordId === partnership.partnershipRecordId
            )
            .sort(byOrder)
          return [{ person: other, partnership, siblings }]
        })
        .sort((a, b) => byOrder(a.person, b.person))
      return { parent, stepParents }
    })
    .filter((group) => group.stepParents.length > 0)

  const nestedStepParentIds = new Set(
    otherFamily.flatMap((group) => group.stepParents.map((node) => node.person.relationshipRecordId))
  )
  const nestedStepSiblingIds = new Set(
    otherFamily.flatMap((group) =>
      group.stepParents.flatMap((node) => node.siblings.map((sibling) => sibling.relationshipRecordId))
    )
  )

  const unlinkedStepParents = people
    .filter(
      (person) =>
        person.relationshipToClient === "step_parent" &&
        !nestedStepParentIds.has(person.relationshipRecordId)
    )
    .sort(byOrder)

  const unlinkedStepSiblings = people
    .filter(
      (person) =>
        NESTED_SIBLINGS.has(person.relationshipToClient) &&
        !nestedStepSiblingIds.has(person.relationshipRecordId)
    )
    .sort(byOrder)

  const partners = people
    .filter((person) => PARTNERS.has(person.relationshipToClient))
    .sort((a, b) => {
      const rank = (role: RelationshipToClient) => (role === "current_partner" ? 0 : 1)
      return rank(a.relationshipToClient) - rank(b.relationshipToClient) || byOrder(a, b)
    })
    .map((person) => ({
      person,
      children: people
        .filter(
          (child) =>
            CHILDREN.has(child.relationshipToClient) &&
            child.linkedPartnerRecordId === person.relationshipRecordId
        )
        .sort(byOrder),
    }))

  const linkedChildIds = new Set(
    partners.flatMap((partner) => partner.children.map((child) => child.relationshipRecordId))
  )
  const unlinkedChildren = people
    .filter(
      (person) =>
        person.relationshipToClient === "child_biological" && !linkedChildIds.has(person.relationshipRecordId)
    )
    .sort(byOrder)

  const unlinkedStepChildren = people
    .filter(
      (person) => person.relationshipToClient === "child_step" && !linkedChildIds.has(person.relationshipRecordId)
    )
    .sort(byOrder)

  return {
    originParents,
    otherCaregivers,
    fullSiblings,
    otherFamily,
    unlinkedStepParents,
    unlinkedStepSiblings,
    partners,
    unlinkedChildren,
    unlinkedStepChildren,
  }
}

export function familyOfOriginLayout(
  tree: RelationshipTree,
  link: { mother: RelationshipRecord | null; father: RelationshipRecord | null }
): {
  parents: RelationshipRecord[]
  caregivers: RelationshipRecord[]
  siblings: RelationshipRecord[]
} {
  const primary = [link.mother, link.father].filter((person): person is RelationshipRecord => person != null)
  const primaryIds = new Set(primary.map((person) => person.relationshipRecordId))
  return {
    parents: [
      ...primary,
      ...tree.originParents.filter((person) => !primaryIds.has(person.relationshipRecordId)),
    ],
    caregivers: tree.otherCaregivers,
    siblings: tree.fullSiblings,
  }
}

/** Family of Origin display order: parents, their relationship, other primary caregivers, then siblings. */
export function familyOfOriginSequence(
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): FamilyOfOriginEntry[] {
  const tree = buildRelationshipTree(people, partnerships)
  const layout = familyOfOriginLayout(tree, canonicalParentsLink(people, partnerships))
  return [
    ...layout.parents.map((person) => ({ kind: "person" as const, id: person.relationshipRecordId })),
    { kind: "parents-relationship" as const },
    ...layout.caregivers.map((person) => ({ kind: "person" as const, id: person.relationshipRecordId })),
    ...layout.siblings.map((person) => ({ kind: "person" as const, id: person.relationshipRecordId })),
  ]
}

export function stepParentLinks(
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): StepParentLink[] {
  const byId = new Map(people.map((person) => [person.relationshipRecordId, person]))
  const links: StepParentLink[] = []
  for (const partnership of partnerships) {
    const a = byId.get(partnership.partnerAId)
    const b = byId.get(partnership.partnerBId)
    if (!a || !b) continue
    const stepParent =
      a.relationshipToClient === "step_parent" ? a : b.relationshipToClient === "step_parent" ? b : null
    const parent = ORIGIN.has(a.relationshipToClient) ? a : ORIGIN.has(b.relationshipToClient) ? b : null
    if (!stepParent || !parent || stepParent.relationshipRecordId === parent.relationshipRecordId) continue
    links.push({ partnershipRecordId: partnership.partnershipRecordId, stepParent, parent })
  }
  return links.sort(
    (a, b) => byOrder(a.stepParent, b.stepParent) || byOrder(a.parent, b.parent)
  )
}

export function linkedParentId(
  stepParentId: string,
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): string | null {
  return (
    stepParentLinks(people, partnerships).find((link) => link.stepParent.relationshipRecordId === stepParentId)
      ?.parent.relationshipRecordId ?? null
  )
}

export function stepParentLinkLabel(link: StepParentLink): string {
  const stepName = link.stepParent.givenName.trim() || personRoleLabel(link.stepParent)
  const parentName = link.parent.givenName.trim() || personRoleLabel(link.parent)
  return `${stepName} (${parentName}'s partner)`
}

export function personWithRoleLabel(person: Pick<RelationshipRecord, "givenName" | "relationshipToClient">): string {
  const name = person.givenName.trim()
  const role = personRoleLabel(person)
  return name ? `${name} (${role})` : role
}

function uniqueStepParentTargets(
  excludeId: string,
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): MoveTarget[] {
  const seen = new Set<string>()
  const targets: MoveTarget[] = []
  for (const link of stepParentLinks(people, partnerships)) {
    const id = link.stepParent.relationshipRecordId
    if (id === excludeId || seen.has(id)) continue
    seen.add(id)
    targets.push({ id, label: stepParentLinkLabel(link) })
  }
  return targets
}

function partnerTargets(excludeId: string, people: RelationshipRecord[]): MoveTarget[] {
  return people
    .filter(
      (person) => PARTNERS.has(person.relationshipToClient) && person.relationshipRecordId !== excludeId
    )
    .sort((a, b) => {
      const rank = (role: RelationshipToClient) => (role === "current_partner" ? 0 : 1)
      return rank(a.relationshipToClient) - rank(b.relationshipToClient) || byOrder(a, b)
    })
    .map((person) => ({ id: person.relationshipRecordId, label: personWithRoleLabel(person) }))
}

function originParentTargets(excludeId: string, people: RelationshipRecord[]): MoveTarget[] {
  return people
    .filter((person) => ORIGIN.has(person.relationshipToClient) && person.relationshipRecordId !== excludeId)
    .sort((a, b) => originRank(a.relationshipToClient) - originRank(b.relationshipToClient) || byOrder(a, b))
    .map((person) => ({ id: person.relationshipRecordId, label: personWithRoleLabel(person) }))
}

/**
 * People whose link breaks when `person` changes to `nextRole`.
 * Half-sibling ↔ step-sibling and child ↔ step-child do not break anyone else's link.
 * Current partner ↔ prior partner does not either.
 */
export function brokenLinksForRoleChange(
  person: RelationshipRecord,
  nextRole: RelationshipToClient,
  people: RelationshipRecord[],
  partnerships: PartnershipRecord[]
): BrokenLinks | null {
  const current = person.relationshipToClient
  if (current === nextRole || current === "mother" || current === "father") return null

  if (current === "step_parent") {
    const partnershipIds = new Set(
      stepParentLinks(people, partnerships)
        .filter((link) => link.stepParent.relationshipRecordId === person.relationshipRecordId)
        .map((link) => link.partnershipRecordId)
    )
    const linked = people
      .filter(
        (item) =>
          NESTED_SIBLINGS.has(item.relationshipToClient) &&
          item.partnershipRecordId != null &&
          partnershipIds.has(item.partnershipRecordId)
      )
      .sort(byOrder)
    if (linked.length === 0) return null
    return {
      kind: "siblings",
      people: linked,
      targets: uniqueStepParentTargets(person.relationshipRecordId, people, partnerships),
    }
  }

  if (
    (current === "current_partner" || current === "prior_partner") &&
    nextRole !== "current_partner" &&
    nextRole !== "prior_partner"
  ) {
    const linked = people
      .filter(
        (item) =>
          CHILDREN.has(item.relationshipToClient) && item.linkedPartnerRecordId === person.relationshipRecordId
      )
      .sort(byOrder)
    if (linked.length === 0) return null
    return {
      kind: "children",
      people: linked,
      targets: partnerTargets(person.relationshipRecordId, people),
    }
  }

  if (current === "parent") {
    const linkedIds = new Set(
      stepParentLinks(people, partnerships)
        .filter((link) => link.parent.relationshipRecordId === person.relationshipRecordId)
        .map((link) => link.stepParent.relationshipRecordId)
    )
    const linked = people.filter((item) => linkedIds.has(item.relationshipRecordId)).sort(byOrder)
    if (linked.length === 0) return null
    return {
      kind: "step-parents",
      people: linked,
      targets: originParentTargets(person.relationshipRecordId, people),
    }
  }

  return null
}
