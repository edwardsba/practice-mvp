import {
  ARRANGEMENT_TYPES,
  BLOCK_ANSWERS,
  CHILD_TYPES,
  CURRENT_BLOCK_STATUSES,
  NEVER_IN_A_RELATIONSHIP,
  PARTNERED_CLIENT_STATUSES,
  PREVIOUS_BLOCK_STATUSES,
  SIBLING_BLOCK_TYPES,
  type ArrangementType,
  type BlockAnswer,
  type BlockKind,
  type BlockRole,
  type ChildType,
  type CurrentBlockStatus,
  type PartnershipRecord,
  type PreviousBlockStatus,
  type RelationshipBlock,
  type RelationshipBlockAnswers,
  type RelationshipRecord,
  type RelationshipToClient,
  type SiblingBlockType,
  emptyBlockAnswers,
} from "@/lib/client-background/types"

export type BlockMembership = {
  relationshipRecordId: string
  relationshipBlockId: string | null
  blockRole: BlockRole | ""
  blockRoleType: string
  placementReview: "" | "unlinked_child" | "unplaced"
}

export type MappedRelationshipBlocks = {
  blocks: RelationshipBlock[]
  membership: BlockMembership[]
  answers: RelationshipBlockAnswers
}

const ORIGIN = new Set(["mother", "father", "parent"])
const CHILD_ROLES = new Set(["child_biological", "child_step"])

export function isPartneredClientStatus(status: string): boolean {
  return (PARTNERED_CLIENT_STATUSES as readonly string[]).includes(status)
}

export function statusesForBlock(kind: BlockKind): readonly string[] {
  if (kind === "client_current") return CURRENT_BLOCK_STATUSES
  if (kind === "client_previous") return PREVIOUS_BLOCK_STATUSES
  if (kind === "biological_parents") return [...CURRENT_BLOCK_STATUSES, ...PREVIOUS_BLOCK_STATUSES, NEVER_IN_A_RELATIONSHIP]
  if (kind === "parent_other") return [...CURRENT_BLOCK_STATUSES, ...PREVIOUS_BLOCK_STATUSES]
  return []
}

export function siblingTypesForBlock(kind: BlockKind): readonly SiblingBlockType[] {
  if (kind === "biological_parents") return ["full"]
  if (kind === "parent_other") return ["half", "step"]
  if (kind === "caregiver_arrangement") return ["adoptive", "foster", "other"]
  return []
}

export function rolesForBlock(kind: BlockKind): readonly BlockRole[] {
  if (kind === "client_current" || kind === "client_previous") return ["partner", "child"]
  if (kind === "client_other_children") return ["child"]
  if (kind === "biological_parents") return ["parent", "sibling"]
  if (kind === "parent_other") return ["partner", "sibling"]
  if (kind === "caregiver_arrangement") return ["caregiver", "sibling"]
  return []
}

export function answerKeyForBlock(
  block: Pick<RelationshipBlock, "kind" | "parentSide">
): keyof RelationshipBlockAnswers | null {
  if (block.kind === "client_previous") return "previousRelationships"
  if (block.kind === "client_other_children") return "otherChildren"
  if (block.kind === "parent_other" && block.parentSide === "mother") return "motherOtherRelationships"
  if (block.kind === "parent_other" && block.parentSide === "father") return "fatherOtherRelationships"
  if (block.kind === "caregiver_arrangement") return "caregiverArrangements"
  return null
}

export function childTypesForBlock(kind: BlockKind): readonly ChildType[] {
  if (kind === "client_current" || kind === "client_previous" || kind === "client_other_children") return CHILD_TYPES
  return []
}

/** Adding a block sets Yes. Removing the last one sets Not asked, never None. */
export function answerAfterBlockCount(count: number): "yes" | "not_asked" {
  return count > 0 ? "yes" : "not_asked"
}

export function previousBlocksInOrder(blocks: RelationshipBlock[]): RelationshipBlock[] {
  return blocks
    .filter((block) => block.kind === "client_previous")
    .sort((a, b) => {
      if (a.startedOn !== b.startedOn) return b.startedOn.localeCompare(a.startedOn)
      return a.displayOrder - b.displayOrder
    })
}

/**
 * Ended status from the old partner type plus how it ended.
 * A missing how-it-ended leaves the status blank.
 */
export function previousStatusFromPartner(partnerType: string, howEnded: string): string {
  const type = partnerType.trim()
  const ended = howEnded.trim()
  if (!ended) return ""
  if (ended === "other") return "other"
  if (type === "married" && ended === "divorced") return "divorced"
  if (type === "married" && ended === "separated") return "married_separated"
  if (type === "married" && ended === "partner_died") return "widowed"
  if (type === "defacto" && ended === "separated") return "defacto_separated"
  if (type === "defacto" && ended === "partner_died") return "partner_died"
  if (type === "engaged") return "engagement_ended"
  if (ended === "divorced") return "divorced"
  if (ended === "separated") return "relationship_ended"
  if (ended === "partner_died") return "partner_died"
  return "other"
}

export function parentsStatusFromPartnership(
  status: string,
  ended: string,
  kind: "biological_parents" | "parent_other"
): string {
  if (status === "divorced") return "divorced"
  if (status === "separated") return "married_separated"
  if (status === "widowed") return "widowed"
  if (status === "never_formalised") return kind === "biological_parents" ? NEVER_IN_A_RELATIONSHIP : ""
  if (status === "married") return ended.trim() ? "married_separated" : "married"
  if (status === "defacto") return ended.trim() ? "defacto_separated" : "defacto"
  return ""
}

export function arrangementTypeForCaregiver(kind: string): ArrangementType {
  if (kind === "grandparent") return "grandparent_care"
  if (kind === "kinship_carer" || kind === "other_relative") return "kinship_care"
  if (kind === "foster_carer") return "foster_care"
  if (kind === "residential") return "residential"
  return "other"
}

export function legacyRoleForMember(kind: BlockKind, role: BlockRole, roleType: string): RelationshipToClient {
  if (role === "partner") {
    if (kind === "client_previous") return "prior_partner"
    if (kind === "parent_other") return "step_parent"
    return "current_partner"
  }
  if (role === "child") return roleType === "step_child" ? "child_step" : "child_biological"
  if (role === "parent") {
    if (roleType === "father") return "father"
    if (roleType === "mother") return "mother"
    return "parent"
  }
  if (role === "sibling") {
    if (roleType === "half") return "sibling_half"
    if (roleType === "step") return "sibling_step"
    if (roleType === "full") return "sibling_full"
    return "sibling_adoptive"
  }
  return "other_caregiver"
}

export function isCurrentBlockStatus(status: string): status is CurrentBlockStatus {
  return (CURRENT_BLOCK_STATUSES as readonly string[]).includes(status)
}

export function isPreviousBlockStatus(status: string): status is PreviousBlockStatus {
  return (PREVIOUS_BLOCK_STATUSES as readonly string[]).includes(status)
}

export function isBlockAnswer(value: string): value is BlockAnswer {
  return (BLOCK_ANSWERS as readonly string[]).includes(value)
}

export function isArrangementType(value: string): value is ArrangementType {
  return (ARRANGEMENT_TYPES as readonly string[]).includes(value)
}

export function isSiblingBlockType(value: string): value is SiblingBlockType {
  return (SIBLING_BLOCK_TYPES as readonly string[]).includes(value)
}

function blankBlock(id: string, kind: BlockKind, displayOrder = 0): RelationshipBlock {
  return {
    relationshipBlockId: id,
    kind,
    parentRecordId: null,
    parentSide: "",
    status: "",
    statusDetail: "",
    arrangementType: "",
    arrangementDetail: "",
    startedOn: "",
    endedOn: "",
    noChildren: false,
    displayOrder,
  }
}

function parentSideOf(person: RelationshipRecord): "mother" | "father" | "" {
  if (person.relationshipToClient === "mother") return "mother"
  if (person.relationshipToClient === "father") return "father"
  const sex = person.sex.trim().toLowerCase()
  if (sex === "female") return "mother"
  if (sex === "male") return "father"
  return ""
}

function childTypeOf(person: RelationshipRecord): string {
  if (person.childType) return person.childType
  if (person.relationshipToClient === "child_step") return "step_child"
  return "biological"
}

function isAdoptiveParent(person: RelationshipRecord): boolean {
  return ORIGIN.has(person.relationshipToClient) && person.parentType === "adoptive"
}

/**
 * Places existing people into relationship blocks.
 * Old link columns are read and left unchanged. Anyone who cannot be placed is marked unplaced.
 */
export function mapRelationshipsToBlocks(input: {
  people: RelationshipRecord[]
  partnerships: PartnershipRecord[]
  clientStatus: string
  id?: () => string
}): MappedRelationshipBlocks {
  let nextId = 0
  const id = input.id ?? (() => `block-${++nextId}`)
  const blocks: RelationshipBlock[] = []
  const placed = new Map<string, BlockMembership>()

  function place(person: RelationshipRecord, blockId: string, role: BlockRole, roleType: string, review: BlockMembership["placementReview"] = "") {
    if (placed.has(person.relationshipRecordId)) return
    placed.set(person.relationshipRecordId, {
      relationshipRecordId: person.relationshipRecordId,
      relationshipBlockId: blockId,
      blockRole: role,
      blockRoleType: roleType,
      placementReview: review,
    })
  }

  function unplaced(person: RelationshipRecord) {
    if (placed.has(person.relationshipRecordId)) return
    placed.set(person.relationshipRecordId, {
      relationshipRecordId: person.relationshipRecordId,
      relationshipBlockId: null,
      blockRole: "",
      blockRoleType: "",
      placementReview: "unplaced",
    })
  }

  const byId = new Map(input.people.map((person) => [person.relationshipRecordId, person]))
  const currentPartners = input.people
    .filter((person) => person.relationshipToClient === "current_partner")
    .sort((a, b) => a.displayOrder - b.displayOrder || a.relationshipRecordId.localeCompare(b.relationshipRecordId))
  const priorPartners = input.people
    .filter((person) => person.relationshipToClient === "prior_partner")
    .sort((a, b) => a.displayOrder - b.displayOrder || a.relationshipRecordId.localeCompare(b.relationshipRecordId))

  const partnerBlock = new Map<string, string>()
  currentPartners.forEach((person, index) => {
    const block = blankBlock(id(), "client_current", index)
    block.startedOn = person.startedOn
    block.endedOn = person.endedOn
    if (index === 0 && isPartneredClientStatus(input.clientStatus)) block.status = input.clientStatus
    blocks.push(block)
    partnerBlock.set(person.relationshipRecordId, block.relationshipBlockId)
    place(person, block.relationshipBlockId, "partner", "")
  })

  const previous: RelationshipBlock[] = []
  for (const person of priorPartners) {
    const block = blankBlock(id(), "client_previous", person.displayOrder)
    block.startedOn = person.startedOn
    block.endedOn = person.endedOn
    block.status = previousStatusFromPartner(person.partnerType, person.howEnded)
    if (block.status === "other") block.statusDetail = person.relationshipStatus
    previous.push(block)
    partnerBlock.set(person.relationshipRecordId, block.relationshipBlockId)
    place(person, block.relationshipBlockId, "partner", "")
  }
  previous
    .sort((a, b) => {
      if (a.startedOn !== b.startedOn) return b.startedOn.localeCompare(a.startedOn)
      return a.displayOrder - b.displayOrder
    })
    .forEach((block, index) => {
      block.displayOrder = index
    })
  blocks.push(...previous)

  let otherChildren: RelationshipBlock | null = null
  function otherBlock() {
    if (!otherChildren) {
      otherChildren = blankBlock(id(), "client_other_children")
      blocks.push(otherChildren)
    }
    return otherChildren
  }

  for (const person of input.people) {
    if (!CHILD_ROLES.has(person.relationshipToClient)) continue
    const linked = person.linkedPartnerRecordId ? partnerBlock.get(person.linkedPartnerRecordId) : undefined
    if (linked) {
      place(person, linked, "child", childTypeOf(person))
      continue
    }
    const special = person.otherParentKind === "donor_conception" || person.otherParentKind === "adopted_sole" || person.otherParentKind === "other"
    const block = otherBlock()
    place(person, block.relationshipBlockId, "child", childTypeOf(person), special ? "" : "unlinked_child")
  }

  const biologicalPeople = input.people.filter(
    (person) => ORIGIN.has(person.relationshipToClient) && !isAdoptiveParent(person)
  )
  const fullSiblings = input.people.filter((person) => person.relationshipToClient === "sibling_full")
  const biologicalIds = new Set(biologicalPeople.map((person) => person.relationshipRecordId))
  const originPartnership = input.partnerships.find(
    (partnership) => biologicalIds.has(partnership.partnerAId) && biologicalIds.has(partnership.partnerBId)
  )
  if (biologicalPeople.length > 0 || fullSiblings.length > 0 || originPartnership) {
    const block = blankBlock(id(), "biological_parents")
    if (originPartnership) {
      block.status = parentsStatusFromPartnership(originPartnership.relationshipStatus, originPartnership.ended, "biological_parents")
      block.startedOn = originPartnership.started
      block.endedOn = originPartnership.ended
    }
    blocks.push(block)
    for (const person of biologicalPeople) {
      const side = parentSideOf(person)
      place(person, block.relationshipBlockId, "parent", side === "mother" || side === "father" ? side : "")
    }
    for (const person of fullSiblings) place(person, block.relationshipBlockId, "sibling", "full")
  }

  const adoptiveParents = input.people.filter(isAdoptiveParent)
  const adoptionGroups = new Map<string, RelationshipRecord[]>()
  for (const person of adoptiveParents) {
    const key = person.adoptedOn.trim()
    adoptionGroups.set(key, [...(adoptionGroups.get(key) ?? []), person])
  }
  const adoptionBlocks: RelationshipBlock[] = []
  for (const [adoptedOn, parents] of adoptionGroups) {
    const block = blankBlock(id(), "caregiver_arrangement", adoptionBlocks.length)
    block.arrangementType = "adoption"
    block.startedOn = adoptedOn
    const ids = new Set(parents.map((person) => person.relationshipRecordId))
    const partnership = input.partnerships.find((item) => ids.has(item.partnerAId) && ids.has(item.partnerBId))
    if (partnership) block.status = parentsStatusFromPartnership(partnership.relationshipStatus, partnership.ended, "parent_other")
    blocks.push(block)
    adoptionBlocks.push(block)
    for (const person of parents) place(person, block.relationshipBlockId, "caregiver", "")
  }
  const adoptiveSiblings = input.people.filter((person) => person.relationshipToClient === "sibling_adoptive")
  if (adoptiveSiblings.length > 0) {
    const block = adoptionBlocks[0] ?? blankBlock(id(), "caregiver_arrangement")
    if (!adoptionBlocks[0]) {
      block.arrangementType = "adoption"
      blocks.push(block)
      adoptionBlocks.push(block)
    }
    for (const person of adoptiveSiblings) place(person, block.relationshipBlockId, "sibling", "adoptive")
  }

  for (const partnership of input.partnerships) {
    const a = byId.get(partnership.partnerAId)
    const b = byId.get(partnership.partnerBId)
    if (!a || !b) continue
    const stepParent = a.relationshipToClient === "step_parent" ? a : b.relationshipToClient === "step_parent" ? b : null
    const parent = ORIGIN.has(a.relationshipToClient) ? a : ORIGIN.has(b.relationshipToClient) ? b : null
    if (!stepParent || !parent || stepParent.relationshipRecordId === parent.relationshipRecordId) continue
    if (placed.has(stepParent.relationshipRecordId)) continue
    const block = blankBlock(id(), "parent_other")
    block.parentRecordId = parent.relationshipRecordId
    block.parentSide = parentSideOf(parent)
    block.status = parentsStatusFromPartnership(partnership.relationshipStatus, partnership.ended, "parent_other")
    block.startedOn = partnership.started
    block.endedOn = partnership.ended
    blocks.push(block)
    place(stepParent, block.relationshipBlockId, "partner", "")
    for (const person of input.people) {
      if (person.partnershipRecordId !== partnership.partnershipRecordId) continue
      if (person.relationshipToClient === "sibling_half") place(person, block.relationshipBlockId, "sibling", "half")
      if (person.relationshipToClient === "sibling_step") place(person, block.relationshipBlockId, "sibling", "step")
    }
  }

  const caregivers = input.people
    .filter((person) => person.relationshipToClient === "other_caregiver")
    .sort((a, b) => a.startedOn.localeCompare(b.startedOn) || a.displayOrder - b.displayOrder)
  caregivers.forEach((person, index) => {
    const block = blankBlock(id(), "caregiver_arrangement", index)
    block.arrangementType = arrangementTypeForCaregiver(person.caregiverRelationship)
    if (block.arrangementType === "other") block.arrangementDetail = person.caregiverRelationshipDetail
    block.startedOn = person.startedOn
    block.endedOn = person.endedOn
    blocks.push(block)
    place(person, block.relationshipBlockId, "caregiver", person.caregiverRelationship)
  })

  for (const person of input.people) unplaced(person)

  const mother = input.people.find((person) => person.relationshipToClient === "mother")
  const father = input.people.find((person) => person.relationshipToClient === "father")
  const motherBlocks = blocks.filter((block) => block.kind === "parent_other" && block.parentSide === "mother").length
  const fatherBlocks = blocks.filter((block) => block.kind === "parent_other" && block.parentSide === "father").length
  const answers = emptyBlockAnswers()
  answers.previousRelationships = blocks.some((block) => block.kind === "client_previous") ? "yes" : "not_asked"
  answers.otherChildren = blocks.some((block) => block.kind === "client_other_children") ? "yes" : "not_asked"
  answers.motherOtherRelationships =
    motherBlocks > 0 || mother?.laterRelationships === "yes"
      ? "yes"
      : mother?.laterRelationships === "none"
        ? "none"
        : "not_asked"
  answers.fatherOtherRelationships =
    fatherBlocks > 0 || father?.laterRelationships === "yes"
      ? "yes"
      : father?.laterRelationships === "none"
        ? "none"
        : "not_asked"
  answers.caregiverArrangements = blocks.some((block) => block.kind === "caregiver_arrangement") ? "yes" : "not_asked"

  return { blocks, membership: [...placed.values()], answers }
}

export type FieldNeed = "status" | "start" | "end" | "sex" | "age" | "type"

/** Amber tags for required fields. Saving is never blocked by these. */
export function needsForBlock(block: RelationshipBlock, lockedStatus: boolean): FieldNeed[] {
  const needs: FieldNeed[] = []
  const startedKinds: BlockKind[] = ["client_current", "client_previous"]
  const endedKinds: BlockKind[] = ["client_previous"]
  if (!lockedStatus && (block.kind === "client_current" || block.kind === "client_previous") && !block.status.trim()) {
    needs.push("status")
  }
  if (startedKinds.includes(block.kind) && !block.startedOn.trim()) needs.push("start")
  if (endedKinds.includes(block.kind) && !block.endedOn.trim()) needs.push("end")
  if (block.kind === "caregiver_arrangement" && !block.arrangementType) needs.push("type")
  return needs
}

export function needsForMember(block: RelationshipBlock, person: RelationshipRecord): FieldNeed[] {
  const needs: FieldNeed[] = []
  const role = person.blockRole
  if (role === "partner") {
    if (!person.sex.trim()) needs.push("sex")
    if (!person.dateOfBirth.trim()) needs.push("age")
  }
  if (role === "child") {
    if (!(person.blockRoleType ?? "").trim() && !person.childType) needs.push("type")
    if (!person.dateOfBirth.trim()) needs.push("age")
  }
  if (role === "sibling" && siblingTypesForBlock(block.kind).length > 1 && !(person.blockRoleType ?? "").trim()) needs.push("type")
  if (role === "caregiver" && block.arrangementType !== "adoption" && !(person.blockRoleType ?? "").trim() && !person.caregiverRelationship.trim()) {
    needs.push("type")
  }
  return needs
}

export function needLabel(need: FieldNeed): string {
  if (need === "status") return "Needs status"
  if (need === "start") return "Needs start"
  if (need === "end") return "Needs end"
  if (need === "sex") return "Needs sex"
  if (need === "age") return "Needs age"
  return "Needs type"
}
