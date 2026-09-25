import {
  ORIGIN_PARENT_ROLES,
  RELATIONSHIP_TO_CLIENT_LABELS,
  type PartnershipRecord,
  type RelationshipRecord,
  type RelationshipToClient,
} from "@/lib/client-background/types"

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
  fullSiblings: RelationshipRecord[]
  otherFamily: OtherFamilyGroup[]
  unlinkedStepParents: RelationshipRecord[]
  unlinkedStepSiblings: RelationshipRecord[]
  partners: PartnerNode[]
  unlinkedChildren: RelationshipRecord[]
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
      (person) => CHILDREN.has(person.relationshipToClient) && !linkedChildIds.has(person.relationshipRecordId)
    )
    .sort(byOrder)

  return {
    originParents,
    fullSiblings,
    otherFamily,
    unlinkedStepParents,
    unlinkedStepSiblings,
    partners,
    unlinkedChildren,
  }
}
