import { estimatedCurrentAge } from "@/lib/client-background/visibility"
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

function treeAgeToken(
  person: Pick<
    RelationshipRecord,
    "dateOfBirth" | "approximateAge" | "approximateAgeRecordedOn" | "healthStatus"
  >,
  asOf: string
): string | null {
  const age = estimatedCurrentAge(person, asOf)
  if (age == null) return null
  return person.dateOfBirth ? String(age) : `~${age}`
}

export function relationshipLineLabel(
  person: Pick<
    RelationshipRecord,
    "relationshipToClient" | "givenName" | "dateOfBirth" | "approximateAge" | "approximateAgeRecordedOn" | "healthStatus"
  >,
  status?: string | null,
  asOf = todayDateString()
): string {
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
