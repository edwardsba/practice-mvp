import type {
  FamilyOfOriginRosterInput,
  PartnersChildrenRosterInput,
  RelationshipRecord,
  RelationshipToClient,
  RosterSlot,
} from "@/lib/intake-interview/types"
import { RELATIONSHIP_TO_CLIENT_LABELS } from "@/lib/intake-interview/constants"

function emptyRelationship(
  slot: RosterSlot,
  index: number,
  linkedPartnerRecordId: string | null
): RelationshipRecord {
  return {
    relationshipRecordId: crypto.randomUUID(),
    section: slot.section,
    rosterKey: slot.rosterKey,
    displayOrder: index,
    relationshipToClient: slot.relationshipToClient,
    givenName: "",
    linkedPartnerRecordId,
    age: null,
    deceased: false,
    ageAtDeath: null,
    healthOrCauseOfDeath: "",
    lengthOfRelationship: "",
    relationshipStatus: "",
    timeSinceEnded: "",
    qualityOfRelationship: "",
    dependency: "",
    livingSituation: "",
  }
}

function countOrZero(value: number | null): number {
  if (value == null || Number.isNaN(value) || value < 0) return 0
  return Math.floor(value)
}

function slotsOfType(
  count: number | null,
  relationshipToClient: RelationshipToClient,
  section: RosterSlot["section"],
  keyPrefix: string,
  linkedPartnerRosterKey: string | null = null
): RosterSlot[] {
  const n = countOrZero(count)
  const slots: RosterSlot[] = []
  for (let i = 0; i < n; i++) {
    const ordinal = n === 1 ? "" : ` ${i + 1}`
    slots.push({
      rosterKey: `${keyPrefix}.${i}`,
      section,
      relationshipToClient,
      linkedPartnerRosterKey,
      label: `${RELATIONSHIP_TO_CLIENT_LABELS[relationshipToClient]}${ordinal}`,
    })
  }
  return slots
}

export function buildFamilyOfOriginSlots(
  roster: FamilyOfOriginRosterInput
): RosterSlot[] {
  return [
    ...slotsOfType(
      roster.parentCount,
      "parent",
      "family_of_origin",
      "parent"
    ),
    ...slotsOfType(
      roster.stepParentCount,
      "step_parent",
      "family_of_origin",
      "step_parent"
    ),
    ...slotsOfType(
      roster.fullSiblingCount,
      "sibling_full",
      "family_of_origin",
      "sibling_full"
    ),
    ...slotsOfType(
      roster.halfSiblingCount,
      "sibling_half",
      "family_of_origin",
      "sibling_half"
    ),
    ...slotsOfType(
      roster.stepSiblingCount,
      "sibling_step",
      "family_of_origin",
      "sibling_step"
    ),
  ]
}

export function buildPartnersChildrenSlots(
  roster: PartnersChildrenRosterInput,
  existingRelationships: RelationshipRecord[]
): RosterSlot[] {
  const current = slotsOfType(
    roster.currentPartnerCount,
    "current_partner",
    "partners_and_children",
    "current_partner"
  )
  const prior = slotsOfType(
    roster.priorPartnerCount,
    "prior_partner",
    "partners_and_children",
    "prior_partner"
  )
  const partners = [...current, ...prior]

  const partnerIdByKey = new Map(
    existingRelationships
      .filter(
        (record) =>
          record.relationshipToClient === "current_partner" ||
          record.relationshipToClient === "prior_partner"
      )
      .map((record) => [record.rosterKey, record.relationshipRecordId])
  )

  const childSlots: RosterSlot[] = []
  for (const partner of partners) {
    const partnerId = partnerIdByKey.get(partner.rosterKey)
    const counts = partnerId
      ? roster.childrenByPartnerId[partnerId]
      : undefined
    childSlots.push(
      ...slotsOfType(
        counts?.biological ?? null,
        "child_biological",
        "partners_and_children",
        `${partner.rosterKey}.child_biological`,
        partner.rosterKey
      ),
      ...slotsOfType(
        counts?.step ?? null,
        "child_step",
        "partners_and_children",
        `${partner.rosterKey}.child_step`,
        partner.rosterKey
      )
    )
  }

  const unlinked = slotsOfType(
    roster.unlinkedChildCount,
    "child_biological",
    "partners_and_children",
    "unlinked_child"
  )

  return [...partners, ...childSlots, ...unlinked]
}

export function mergeRosterRecords(
  existing: RelationshipRecord[],
  slots: RosterSlot[]
): RelationshipRecord[] {
  const byKey = new Map(existing.map((record) => [record.rosterKey, record]))
  const partnerIdByKey = new Map<string, string>()

  const merged: RelationshipRecord[] = []
  slots.forEach((slot, index) => {
    const previous = byKey.get(slot.rosterKey)
    let linkedPartnerRecordId: string | null = null
    if (slot.linkedPartnerRosterKey) {
      linkedPartnerRecordId =
        partnerIdByKey.get(slot.linkedPartnerRosterKey) ??
        previous?.linkedPartnerRecordId ??
        null
    }

    const record = previous
      ? {
          ...previous,
          displayOrder: index,
          relationshipToClient: slot.relationshipToClient,
          section: slot.section,
          linkedPartnerRecordId,
        }
      : emptyRelationship(slot, index, linkedPartnerRecordId)

    if (
      slot.relationshipToClient === "current_partner" ||
      slot.relationshipToClient === "prior_partner"
    ) {
      partnerIdByKey.set(slot.rosterKey, record.relationshipRecordId)
    }
    merged.push(record)
  })

  return merged
}

export function suggestedParentCount(
  maritalStatus: FamilyOfOriginRosterInput["parentsMaritalStatus"]
): number | null {
  if (!maritalStatus) return null
  if (maritalStatus === "other") return null
  return 2
}

export function relationshipDisplayLabel(record: RelationshipRecord): string {
  const typeLabel = RELATIONSHIP_TO_CLIENT_LABELS[record.relationshipToClient]
  const name = record.givenName.trim()
  return name ? `${name} (${typeLabel})` : typeLabel
}
