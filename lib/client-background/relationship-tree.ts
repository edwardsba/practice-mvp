import { previousBlocksInOrder } from "@/lib/client-background/relationship-blocks"
import {
  ARRANGEMENT_TYPE_LABELS,
  CAREGIVER_RELATIONSHIP_LABELS,
  CURRENT_BLOCK_STATUS_LABELS,
  NEVER_IN_A_RELATIONSHIP,
  PREVIOUS_BLOCK_STATUS_LABELS,
  type ArrangementType,
  type BlockKind,
  type RelationshipBlock,
  type RelationshipBlockAnswers,
  type RelationshipRecord,
} from "@/lib/client-background/types"
import { ageOn, personAge } from "@/lib/reports/background-report-prose"
import { relationshipDuration } from "@/lib/reports/relationship-block-report"

export type RelationshipTreePerson = {
  kind: "person"
  id: string
  name: string
  title: string
  context: string
  line: string
  deceased: boolean
  initial: string
}

export type RelationshipTreeGroup = {
  kind: "group"
  label: string
  empty: string | null
  children: RelationshipTreeNode[]
}

export type RelationshipTreeBlock = {
  kind: "block"
  id: string
  heading: string
  meta: string
  children: RelationshipTreeNode[]
}

export type RelationshipTreeNote = {
  kind: "note"
  text: string
}

export type RelationshipTreeNode =
  | RelationshipTreeBlock
  | RelationshipTreeGroup
  | RelationshipTreePerson
  | RelationshipTreeNote

export type RelationshipTreeCard = {
  title: string
  children: RelationshipTreeNode[]
}

export type RelationshipTree = {
  partners: RelationshipTreeCard
  parents: RelationshipTreeCard
}

type TreeInput = {
  blocks: RelationshipBlock[]
  relationships: RelationshipRecord[]
  blockAnswers: RelationshipBlockAnswers
  dateOfBirth: string | null
  asOf: string
  /** The client's own record is never drawn, even if one is passed in. */
  clientId?: string
}

export function buildRelationshipTree(input: TreeInput): RelationshipTree {
  const people = input.relationships.filter((person) => person.relationshipRecordId !== input.clientId)
  const partners: RelationshipTreeNode[] = []
  for (const block of input.blocks.filter((item) => item.kind === "client_current")) {
    partners.push(blockNode(block, people, input))
  }
  for (const block of previousBlocksInOrder(input.blocks)) {
    partners.push(blockNode(block, people, input))
  }
  const otherChildren = input.blocks.filter((item) => item.kind === "client_other_children")
  if (otherChildren.length > 0) {
    for (const block of otherChildren) partners.push(blockNode(block, people, input))
  } else if (input.blockAnswers.otherChildren === "none") {
    partners.push({ kind: "note", text: "Other children: none" })
  } else if (input.blockAnswers.otherChildren === "not_asked") {
    partners.push({ kind: "note", text: "Other children: not asked" })
  }

  const parents: RelationshipTreeNode[] = []
  for (const block of input.blocks.filter((item) => item.kind === "biological_parents")) {
    parents.push(blockNode(block, people, input))
  }
  for (const block of sideBlocks(input.blocks, "mother")) parents.push(blockNode(block, people, input))
  if (!input.blocks.some((item) => item.kind === "parent_other" && item.parentSide === "mother")) {
    const note = answerNote("Mother's other relationships", input.blockAnswers.motherOtherRelationships)
    if (note) parents.push(note)
  }
  for (const block of sideBlocks(input.blocks, "father")) parents.push(blockNode(block, people, input))
  const fatherNote = input.blocks.some((item) => item.kind === "parent_other" && item.parentSide === "father")
    ? null
    : answerNote("Father's other relationships", input.blockAnswers.fatherOtherRelationships)
  if (fatherNote) parents.push(fatherNote)
  for (const block of input.blocks
    .filter((item) => item.kind === "caregiver_arrangement")
    .sort((a, b) => a.startedOn.localeCompare(b.startedOn) || a.displayOrder - b.displayOrder)) {
    parents.push(blockNode(block, people, input))
  }
  const placed = new Set(input.blocks.map((block) => block.relationshipBlockId))
  const unplaced = people.filter((person) => !person.relationshipBlockId || !placed.has(person.relationshipBlockId))
  if (unplaced.length > 0) {
    parents.push({
      kind: "group",
      label: "Not placed",
      empty: null,
      children: unplaced.map((person) => personNode(person, null, people, input)),
    })
  }

  return {
    partners: { title: "Partners and children", children: partners },
    parents: { title: "Parents, caregivers and siblings", children: parents },
  }
}

/** The block this person sits in, then a parent's other relationships. */
export function linesAboutPerson(
  person: RelationshipRecord,
  blocks: RelationshipBlock[],
  people: RelationshipRecord[]
): string[] {
  const block = blocks.find((item) => item.relationshipBlockId === person.relationshipBlockId)
  if (!block) return []
  const lines = [blockLine(person, block, people)]
  if (person.blockRole !== "parent") return lines
  const others = blocks
    .filter(
      (item) =>
        item.kind === "parent_other" &&
        (item.parentRecordId === person.relationshipRecordId ||
          (!item.parentRecordId && item.parentSide === person.blockRoleType))
    )
    .sort((a, b) => a.startedOn.localeCompare(b.startedOn))
  for (const other of others) {
    const partner = members(other, people, "partner").find((item) => item.givenName.trim())
    const span = yearSpan(other)
    const status = statusText(other)
    const who = partner ? ` (${partner.givenName.trim()})` : ""
    lines.push([status, span].filter(Boolean).join(", ") + who)
  }
  return lines.filter(Boolean)
}

function answerNote(label: string, answer: string): RelationshipTreeNote | null {
  if (answer === "none") return { kind: "note", text: `${label}: none` }
  if (answer === "not_asked") return { kind: "note", text: `${label}: not asked` }
  return null
}

function sideBlocks(blocks: RelationshipBlock[], side: "mother" | "father"): RelationshipBlock[] {
  return blocks
    .filter((block) => block.kind === "parent_other" && block.parentSide === side)
    .sort((a, b) => a.startedOn.localeCompare(b.startedOn) || a.displayOrder - b.displayOrder)
}

function blockNode(block: RelationshipBlock, people: RelationshipRecord[], input: TreeInput): RelationshipTreeBlock {
  return {
    kind: "block",
    id: block.relationshipBlockId,
    heading: headingFor(block),
    meta: metaFor(block, input.dateOfBirth, input.asOf),
    children: childrenFor(block, people, input),
  }
}

function childrenFor(block: RelationshipBlock, people: RelationshipRecord[], input: TreeInput): RelationshipTreeNode[] {
  const nodes: RelationshipTreeNode[] = []
  if (block.kind === "biological_parents") {
    nodes.push(
      ...members(block, people, "parent")
        .sort((a, b) => parentRank(a) - parentRank(b) || a.displayOrder - b.displayOrder)
        .map((person) => personNode(person, block, people, input))
    )
    nodes.push(siblingGroup(block, people, input, "Siblings · eldest first", "No siblings"))
    return nodes
  }
  if (block.kind === "parent_other") {
    nodes.push(...members(block, people, "partner").map((person) => personNode(person, block, people, input)))
    nodes.push(siblingGroup(block, people, input, "Siblings", "No siblings from this relationship"))
    return nodes
  }
  if (block.kind === "caregiver_arrangement") {
    nodes.push(...members(block, people, "caregiver").map((person) => personNode(person, block, people, input)))
    const siblings = siblingPeople(block, people, input.asOf)
    if (siblings.length > 0) nodes.push(siblingGroup(block, people, input, "Siblings", null))
    return nodes
  }
  if (block.kind === "client_other_children") {
    const children = members(block, people, "child").map((person) => personNode(person, block, people, input))
    if (children.length === 0) nodes.push({ kind: "group", label: "Children", empty: "No children", children: [] })
    else nodes.push(...children)
    return nodes
  }
  nodes.push(...members(block, people, "partner").map((person) => personNode(person, block, people, input)))
  const recorded = members(block, people, "child")
  nodes.push({
    kind: "group",
    label: "Children",
    empty: recorded.length === 0 ? "No children" : null,
    children: recorded.map((person) => personNode(person, block, people, input)),
  })
  return nodes
}

function siblingGroup(
  block: RelationshipBlock,
  people: RelationshipRecord[],
  input: TreeInput,
  label: string,
  empty: string | null
): RelationshipTreeGroup {
  const siblings = siblingPeople(block, people, input.asOf).map((person) => personNode(person, block, people, input))
  return { kind: "group", label, empty: siblings.length === 0 ? empty : null, children: siblings }
}

function siblingPeople(block: RelationshipBlock, people: RelationshipRecord[], asOf: string): RelationshipRecord[] {
  return members(block, people, "sibling").sort((a, b) => {
    const ageA = a.dateOfBirth.trim() ? personAge(a.dateOfBirth, asOf) : null
    const ageB = b.dateOfBirth.trim() ? personAge(b.dateOfBirth, asOf) : null
    if (ageA == null && ageB == null) return a.displayOrder - b.displayOrder
    if (ageA == null) return 1
    if (ageB == null) return -1
    if (ageA !== ageB) return ageB - ageA
    return a.displayOrder - b.displayOrder
  })
}

function members(block: RelationshipBlock, people: RelationshipRecord[], role: string): RelationshipRecord[] {
  return people
    .filter((person) => person.relationshipBlockId === block.relationshipBlockId && person.blockRole === role)
    .sort((a, b) => a.displayOrder - b.displayOrder)
}

function parentRank(person: RelationshipRecord): number {
  if (person.blockRoleType === "mother" || person.relationshipToClient === "mother") return 0
  if (person.blockRoleType === "father" || person.relationshipToClient === "father") return 1
  return 2
}

function personNode(
  person: RelationshipRecord,
  block: RelationshipBlock | null,
  people: RelationshipRecord[],
  input: TreeInput
): RelationshipTreePerson {
  const role = roleWord(person, block)
  const deceased = person.deceased || person.healthStatus === "deceased"
  const notKnown = person.notKnown && person.blockRole === "parent"
  const name = notKnown ? panelTitle(role) : person.givenName.trim() || panelTitle(role)
  const context = block ? blockContext(block) : "Not placed"
  return {
    kind: "person",
    id: person.relationshipRecordId,
    name,
    title: panelTitle(role),
    context,
    line: personLine(person, role, deceased, notKnown, block, people, input),
    deceased,
    initial: name.slice(0, 1).toUpperCase() || "?",
  }
}

function personLine(
  person: RelationshipRecord,
  role: string,
  dead: boolean,
  notKnown: boolean,
  block: RelationshipBlock | null,
  people: RelationshipRecord[],
  input: TreeInput
): string {
  if (notKnown) return `${panelTitle(role)} · not known`
  const name = person.givenName.trim() || panelTitle(role)
  const bits = [name, role]
  if (dead) {
    const year = yearOf(person.dateOfDeath)
    const clientAge = year && input.dateOfBirth ? ageOn(input.dateOfBirth, person.dateOfDeath) : null
    if (person.blockRole === "parent" && year) {
      bits.push(clientAge != null ? `died ${year} (client ${clientAge})` : `died ${year}`)
    } else if (year) bits.push(`died ${year}`)
    else bits.push("deceased")
  } else {
    const age = person.dateOfBirth.trim() ? personAge(person.dateOfBirth, input.asOf) : null
    if (age != null) bits.push(String(age))
  }
  const type = typeWord(person, block, people)
  if (type) bits.push(type)
  return bits.join(" · ")
}

function roleWord(person: RelationshipRecord, block: RelationshipBlock | null): string {
  const sex = sexOf(person)
  if (!block) return (person.blockRole || "person").replaceAll("_", " ")
  if (person.blockRole === "partner") {
    if (block.kind === "parent_other") {
      if (sex === "female") return "step-mother"
      if (sex === "male") return "step-father"
      return "partner"
    }
    if (block.kind === "client_current" && block.status === "married") {
      if (sex === "female") return "wife"
      if (sex === "male") return "husband"
    }
    if (block.kind === "client_previous" || block.kind === "client_current") {
      if (sex === "female") return block.kind === "client_previous" ? "woman" : "partner"
      if (sex === "male") return block.kind === "client_previous" ? "man" : "partner"
    }
    return "partner"
  }
  if (person.blockRole === "child") {
    if (sex === "female") return "daughter"
    if (sex === "male") return "son"
    return "child"
  }
  if (person.blockRole === "sibling") {
    if (sex === "female") return "sister"
    if (sex === "male") return "brother"
    return "sibling"
  }
  if (person.blockRole === "parent") {
    if (person.blockRoleType === "father" || person.relationshipToClient === "father") return "father"
    return "mother"
  }
  const detail = person.caregiverRelationshipDetail.trim()
  if (detail) return detail.toLowerCase()
  const key = person.blockRoleType || person.caregiverRelationship
  if (key && key in CAREGIVER_RELATIONSHIP_LABELS) {
    return CAREGIVER_RELATIONSHIP_LABELS[key as keyof typeof CAREGIVER_RELATIONSHIP_LABELS].toLowerCase()
  }
  return "caregiver"
}

function typeWord(person: RelationshipRecord, block: RelationshipBlock | null, people: RelationshipRecord[]): string {
  if (person.blockRole === "child") {
    const type = person.blockRoleType || person.childType
    if (type === "step_child") {
      const partner = block ? members(block, people, "partner").find((item) => item.givenName.trim()) : undefined
      return partner ? `step-child (${partner.givenName.trim()}'s)` : "step-child"
    }
    if (type === "biological") return "biological"
    if (type === "adopted") return "adopted"
    if (type === "foster") return "foster"
    if (type === "other") return person.childTypeDetail.trim() || "other"
    return ""
  }
  if (person.blockRole === "sibling") {
    const type = person.blockRoleType ?? ""
    if (type === "full" || type === "adopted" || type === "half" || type === "step" || type === "adoptive" || type === "foster" || type === "other") {
      return type
    }
  }
  return ""
}

function panelTitle(role: string): string {
  if (role === "step-father") return "Step-father"
  if (role === "step-mother") return "Step-mother"
  if (role === "step-child") return "Step-child"
  if (!role) return "Person"
  return role.slice(0, 1).toUpperCase() + role.slice(1)
}

function blockContext(block: RelationshipBlock): string {
  if (block.kind === "client_current") return "Current relationship"
  if (block.kind === "client_previous") return "Previous relationship"
  if (block.kind === "client_other_children") return "Other children"
  if (block.kind === "biological_parents") return "Biological parents"
  if (block.kind === "parent_other") return block.parentSide === "father" ? "Father's relationship" : "Mother's relationship"
  return "Caregiver arrangement"
}

export function headingFor(block: RelationshipBlock): string {
  const status = block.kind === "caregiver_arrangement" ? arrangementText(block) : statusText(block)
  const title = blockContext(block).replace("Previous relationship", "Previous")
  if (!status || block.kind === "client_other_children") return title
  return `${title} · ${status}`
}

function metaFor(block: RelationshipBlock, dateOfBirth: string | null, asOf: string): string {
  const span = yearSpan(block)
  const bits = [span].filter(Boolean)
  if (block.kind === "client_current" || block.kind === "client_previous") {
    const duration = relationshipDuration(block.startedOn, block.kind === "client_current" ? "" : block.endedOn, asOf)
    if (duration) bits.push(duration)
    return bits.join(" · ")
  }
  if (!dateOfBirth) return bits.join(" · ")
  if (block.kind !== "biological_parents" && block.kind !== "parent_other" && block.kind !== "caregiver_arrangement") {
    return bits.join(" · ")
  }
  const startAge = block.startedOn.trim() ? ageOn(dateOfBirth, block.startedOn) : null
  const endAge = block.endedOn.trim() ? ageOn(dateOfBirth, block.endedOn) : null
  if (block.kind === "biological_parents") {
    if (endAge != null) bits.push(`client aged ${endAge}`)
    else if (startAge != null) bits.push(`client aged ${startAge}`)
  } else if (startAge != null && endAge != null) bits.push(`client aged ${startAge} to ${endAge}`)
  else if (startAge != null) bits.push(`client aged ${startAge}`)
  else if (endAge != null) bits.push(`client aged ${endAge}`)
  return bits.join(" · ")
}

function yearSpan(block: RelationshipBlock): string {
  const start = yearOf(block.startedOn)
  const end = yearOf(block.endedOn)
  if (start && end && block.endedOn.trim() && block.kind !== "client_current") return `${start}–${end}`
  if (start && (block.kind === "client_current" || !block.endedOn.trim())) return `since ${start}`
  if (start) return start
  if (end) return `until ${end}`
  return ""
}

function yearOf(value: string): string {
  return /^(\d{4})/.exec(value.trim())?.[1] ?? ""
}

function statusText(block: RelationshipBlock): string {
  if (block.status === "other") return block.statusDetail.trim() || "Other"
  if (block.status === NEVER_IN_A_RELATIONSHIP) return "Never in a relationship"
  if (block.status in CURRENT_BLOCK_STATUS_LABELS) {
    return CURRENT_BLOCK_STATUS_LABELS[block.status as keyof typeof CURRENT_BLOCK_STATUS_LABELS]
  }
  if (block.status in PREVIOUS_BLOCK_STATUS_LABELS) {
    return PREVIOUS_BLOCK_STATUS_LABELS[block.status as keyof typeof PREVIOUS_BLOCK_STATUS_LABELS]
  }
  return ""
}

function arrangementText(block: RelationshipBlock): string {
  if (block.arrangementType === "other") return block.arrangementDetail.trim() || "Other"
  if (block.arrangementType in ARRANGEMENT_TYPE_LABELS) {
    return ARRANGEMENT_TYPE_LABELS[block.arrangementType as ArrangementType]
  }
  return ""
}

function blockLine(person: RelationshipRecord, block: RelationshipBlock, people: RelationshipRecord[]): string {
  const status = block.kind === "caregiver_arrangement" ? arrangementText(block) : statusText(block)
  const span = yearSpan(block)
  const detail = [status, span].filter(Boolean).join(", ")
  if (person.blockRole === "parent" && block.kind === "biological_parents") {
    const other = members(block, people, "parent").find((item) => item.relationshipRecordId !== person.relationshipRecordId)
    const otherRole = other?.blockRoleType === "father" || other?.relationshipToClient === "father" ? "father" : other ? "mother" : ""
    if (otherRole) return `With client's ${otherRole}: ${detail}`
  }
  const context = blockContext(block)
  return detail ? `${context}: ${detail}` : context
}

function sexOf(person: RelationshipRecord): "female" | "male" | "" {
  const value = person.sex.trim().toLowerCase()
  if (value === "female") return "female"
  if (value === "male") return "male"
  return ""
}

export function addTargetKind(id: string): { kind: BlockKind; parentSide: "" | "mother" | "father" } | null {
  if (id === "new-current") return { kind: "client_current", parentSide: "" }
  if (id === "new-previous") return { kind: "client_previous", parentSide: "" }
  if (id === "new-biological") return { kind: "biological_parents", parentSide: "" }
  if (id === "new-mother") return { kind: "parent_other", parentSide: "mother" }
  if (id === "new-father") return { kind: "parent_other", parentSide: "father" }
  if (id === "new-caregiver") return { kind: "caregiver_arrangement", parentSide: "" }
  if (id === "new-other-children") return { kind: "client_other_children", parentSide: "" }
  return null
}
