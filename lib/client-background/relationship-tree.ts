import { NEW_CURRENT_RELATIONSHIP, NEW_PREVIOUS_RELATIONSHIP, previousBlocksInOrder } from "@/lib/client-background/relationship-blocks"
import {
  ARRANGEMENT_TYPE_LABELS,
  CAREGIVER_RELATIONSHIP_LABELS,
  CLIENT_RELATIONSHIP_STATUS_LABELS,
  CURRENT_BLOCK_STATUS_LABELS,
  NEVER_IN_A_RELATIONSHIP,
  PREVIOUS_BLOCK_STATUS_LABELS,
  type ArrangementType,
  type BlockAnswer,
  type BlockKind,
  type ClientRelationshipStatus,
  type ClientRelationshipStatusValue,
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
  /** Children or siblings, drawn under this person. Empty when they sit elsewhere. */
  children: RelationshipTreeNode[]
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
  /** False for the client's status-only row when there is no current block. */
  interactive?: boolean
}

export type RelationshipTreeNote = {
  kind: "note"
  text: string
}

export type RelationshipTreeSection = {
  kind: "section"
  title: string
  children: RelationshipTreeNode[]
}

export type RelationshipTreeNode =
  | RelationshipTreeBlock
  | RelationshipTreeGroup
  | RelationshipTreePerson
  | RelationshipTreeNote
  | RelationshipTreeSection

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
  /** Client's own relationship status — used when there is no current block. */
  relationshipStatus?: ClientRelationshipStatusValue
}

export function buildRelationshipTree(input: TreeInput): RelationshipTree {
  const people = input.relationships.filter((person) => person.relationshipRecordId !== input.clientId)
  const partners: RelationshipTreeNode[] = []

  const currentBlocks = input.blocks
    .filter((item) => item.kind === "client_current")
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const currentChildren: RelationshipTreeNode[] =
    currentBlocks.length > 0
      ? currentBlocks.map((block) => blockNode(block, people, input, "status"))
      : [clientStatusRow(input)]
  partners.push(section("Current intimate relationship and children", currentChildren))

  const previous = previousBlocksInOrder(input.blocks)
  const previousNodes = blocksOrAnswer(previous, input.blockAnswers.previousRelationships, people, input)
  if (previous.length > 0 || input.blockAnswers.previousRelationships === "none" || input.blockAnswers.previousRelationships === "not_asked") {
    partners.push(section("Previous intimate relationships and children", previousNodes))
  }

  const otherChildren = input.blocks
    .filter((item) => item.kind === "client_other_children")
    .sort((a, b) => a.displayOrder - b.displayOrder)
  if (otherChildren.length > 0) {
    partners.push(
      section(
        "Other children",
        otherChildren.map((block) => blockNode(block, people, input, "other"))
      )
    )
  }

  const parents: RelationshipTreeNode[] = [
    section(
      "Biological parents",
      input.blocks
        .filter((block) => block.kind === "biological_parents")
        .map((block) => blockNode(block, people, input, "status"))
    ),
    section(
      otherRelationshipsTitle("Mother", parentGivenName(input.blocks, people, "mother")),
      blocksOrAnswer(parentOtherInOrder(input.blocks, "mother"), input.blockAnswers.motherOtherRelationships, people, input)
    ),
    section(
      otherRelationshipsTitle("Father", parentGivenName(input.blocks, people, "father")),
      blocksOrAnswer(parentOtherInOrder(input.blocks, "father"), input.blockAnswers.fatherOtherRelationships, people, input)
    ),
    section(
      "Other caregiver arrangements",
      blocksOrAnswer(caregiversInOrder(input.blocks), input.blockAnswers.caregiverArrangements, people, input)
    ),
  ]
  const placed = new Set(input.blocks.map((block) => block.relationshipBlockId))
  const unplaced = people.filter((person) => !person.relationshipBlockId || !placed.has(person.relationshipBlockId))
  if (unplaced.length > 0) {
    parents.push(section("Not placed", unplaced.map((person) => personNode(person, null, people, input))))
  }

  return {
    partners: { title: "Intimate relationships and children", children: partners },
    parents: { title: "Primary caregivers and siblings", children: parents },
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

function section(title: string, children: RelationshipTreeNode[]): RelationshipTreeSection {
  return { kind: "section", title, children }
}

function clientStatusRow(input: TreeInput): RelationshipTreeBlock {
  const status = input.relationshipStatus?.relationshipStatus ?? ""
  const other = input.relationshipStatus?.relationshipStatusOther?.trim() ?? ""
  let heading = "Status not recorded"
  if (status === "other") heading = other || "Other"
  else if (status && status in CLIENT_RELATIONSHIP_STATUS_LABELS) {
    heading = CLIENT_RELATIONSHIP_STATUS_LABELS[status as ClientRelationshipStatus]
  }
  return {
    kind: "block",
    id: "",
    heading,
    meta: "",
    children: [],
    interactive: false,
  }
}

function blocksOrAnswer(
  blocks: RelationshipBlock[],
  answer: string,
  people: RelationshipRecord[],
  input: TreeInput
): RelationshipTreeNode[] {
  if (blocks.length > 0) return blocks.map((block) => blockNode(block, people, input, "status"))
  if (answer === "none") return [{ kind: "note", text: "None" }]
  if (answer === "not_asked") return [{ kind: "note", text: "Not asked" }]
  return []
}

function otherRelationshipsTitle(role: "Mother" | "Father", name: string): string {
  return name ? `${role} (${name}) · other relationships` : `${role} · other relationships`
}

function parentGivenName(blocks: RelationshipBlock[], people: RelationshipRecord[], side: "mother" | "father"): string {
  const biological = blocks.find((block) => block.kind === "biological_parents")
  if (!biological) return ""
  const person = members(biological, people, "parent").find((item) => item.blockRoleType === side || item.relationshipToClient === side)
  return person?.givenName.trim() ?? ""
}

/** Ongoing relationships first, then ended ones, most recent start (or end) first. */
function parentOtherInOrder(blocks: RelationshipBlock[], side: "mother" | "father"): RelationshipBlock[] {
  const mine = blocks.filter((block) => block.kind === "parent_other" && block.parentSide === side)
  return [...mine.filter((block) => !block.endedOn.trim()).sort(mostRecent), ...mine.filter((block) => block.endedOn.trim()).sort(mostRecent)]
}

function caregiversInOrder(blocks: RelationshipBlock[]): RelationshipBlock[] {
  return blocks.filter((block) => block.kind === "caregiver_arrangement").sort(mostRecent)
}

function mostRecent(a: RelationshipBlock, b: RelationshipBlock): number {
  const key = (block: RelationshipBlock) => block.startedOn.trim() || block.endedOn.trim()
  const byDate = key(b).localeCompare(key(a))
  return byDate || a.displayOrder - b.displayOrder
}

function blockNode(
  block: RelationshipBlock,
  people: RelationshipRecord[],
  input: TreeInput,
  band: "full" | "status" | "other" = "full"
): RelationshipTreeBlock {
  return {
    kind: "block",
    id: block.relationshipBlockId,
    heading: band === "status" ? statusHeading(block) : band === "other" ? otherChildrenHeading(block) : headingFor(block, people),
    meta: metaFor(block, input.dateOfBirth, input.asOf),
    children: childrenFor(block, people, input),
  }
}

function statusHeading(block: RelationshipBlock): string {
  const status = block.kind === "caregiver_arrangement" ? arrangementText(block) : statusText(block)
  const label = status || (block.kind === "caregiver_arrangement" ? "Caregiver arrangement" : "Status not recorded")
  if (block.kind === "parent_other" && !block.endedOn.trim()) return `${label} · current`
  return label
}

function otherChildrenHeading(block: RelationshipBlock): string {
  return block.statusDetail.trim() || "Unrecorded relationship"
}

function childrenFor(block: RelationshipBlock, people: RelationshipRecord[], input: TreeInput): RelationshipTreeNode[] {
  if (block.kind === "biological_parents") {
    const parents = members(block, people, "parent")
      .sort((a, b) => parentRank(a) - parentRank(b) || a.displayOrder - b.displayOrder)
      .map((person) => personNode(person, block, people, input))
    return nestUnderLast(parents, siblingNodes(block, people, input))
  }
  if (block.kind === "parent_other") {
    const partners = members(block, people, "partner").map((person) => personNode(person, block, people, input))
    return nestUnderLast(partners, siblingNodes(block, people, input))
  }
  if (block.kind === "caregiver_arrangement") {
    const caregivers = members(block, people, "caregiver").map((person) => personNode(person, block, people, input))
    const siblings = siblingNodes(block, people, input)
    if (siblings.length === 0) return caregivers
    return nestUnderLast(caregivers, siblings)
  }
  if (block.kind === "client_other_children") {
    const children = members(block, people, "child").map((person) => personNode(person, block, people, input))
    return children.length > 0 ? children : childAnswerNodes(block)
  }
  const partners = members(block, people, "partner").map((person) => personNode(person, block, people, input))
  const children = members(block, people, "child").map((person) => personNode(person, block, people, input))
  return nestUnderLast(partners, children.length > 0 ? children : childAnswerNodes(block))
}

function childAnswerNodes(block: RelationshipBlock): RelationshipTreeNode[] {
  const answer = resolvedChildrenAnswer(block)
  if (answer === "none") return [{ kind: "note", text: "No children" }]
  if (answer === "not_asked") return [{ kind: "note", text: "Children not asked" }]
  return []
}

function siblingNodes(block: RelationshipBlock, people: RelationshipRecord[], input: TreeInput): RelationshipTreeNode[] {
  const siblings = siblingPeople(block, people, input.asOf).map((person) => personNode(person, block, people, input))
  if (siblings.length > 0) return siblings
  const answer = resolvedSiblingsAnswer(block)
  if (answer === "none") return [{ kind: "note", text: "No siblings" }]
  if (answer === "not_asked") return [{ kind: "note", text: "Siblings not asked" }]
  // Biological parents previously always showed "No siblings" when empty; keep that when answer is blank
  // only after the interview answer is set. Blank answer shows nothing (Worth checking).
  return []
}

function resolvedChildrenAnswer(block: RelationshipBlock): BlockAnswer | "" {
  if (block.childrenAnswer === "yes" || block.childrenAnswer === "none" || block.childrenAnswer === "not_asked") {
    return block.childrenAnswer
  }
  return ""
}

function resolvedSiblingsAnswer(block: RelationshipBlock): BlockAnswer | "" {
  if (block.siblingsAnswer === "yes" || block.siblingsAnswer === "none" || block.siblingsAnswer === "not_asked") {
    return block.siblingsAnswer
  }
  return ""
}

/** The nested people hang off the last partner, parent, or caregiver. With none yet, they sit on the first level. */
function nestUnderLast(leaders: RelationshipTreePerson[], nested: RelationshipTreeNode[]): RelationshipTreeNode[] {
  if (nested.length === 0) return leaders
  if (leaders.length === 0) return nested
  const last = leaders[leaders.length - 1]
  return [...leaders.slice(0, -1), { ...last, children: nested }]
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
    children: [],
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
    if (year) bits.push(clientAge != null ? `died ${year} (client ${clientAge})` : `died ${year}`)
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
    const type = person.blockRoleType ?? ""
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

/** Blocks a person can move to, in tree order, without their current block. */
export function moveTargets(
  blocks: RelationshipBlock[],
  currentBlockId: string | null,
  people: RelationshipRecord[] = []
): { id: string; label: string; kind: BlockKind }[] {
  const targets: { id: string; label: string; kind: BlockKind }[] = []
  const add = (block: RelationshipBlock) => {
    if (currentBlockId && block.relationshipBlockId === currentBlockId) return
    targets.push({ id: block.relationshipBlockId, label: moveLabel(block, people), kind: block.kind })
  }
  const byOrder = (a: RelationshipBlock, b: RelationshipBlock) => a.displayOrder - b.displayOrder
  for (const block of blocks.filter((item) => item.kind === "client_current").sort(byOrder)) add(block)
  for (const block of previousBlocksInOrder(blocks)) add(block)
  for (const block of blocks.filter((item) => item.kind === "client_other_children").sort(byOrder)) add(block)
  for (const block of blocks.filter((item) => item.kind === "biological_parents").sort(byOrder)) add(block)
  for (const block of parentOtherInOrder(blocks, "mother")) add(block)
  for (const block of parentOtherInOrder(blocks, "father")) add(block)
  for (const block of caregiversInOrder(blocks)) add(block)
  targets.push({ id: NEW_CURRENT_RELATIONSHIP, label: "+ New current relationship", kind: "client_current" })
  targets.push({ id: NEW_PREVIOUS_RELATIONSHIP, label: "+ New previous relationship", kind: "client_previous" })
  return targets
}

export function moveLabel(block: RelationshipBlock, people: RelationshipRecord[] = []): string {
  if (block.kind === "client_current") {
    const status = statusText(block) || "Status not recorded"
    return `Current · ${status}`
  }
  if (block.kind === "client_previous") {
    const status = statusText(block) || "Status not recorded"
    const partner = members(block, people, "partner").find((item) => item.givenName.trim())
    const who = partner ? ` (${partner.givenName.trim()})` : ""
    return `Previous · ${status}${who}`
  }
  if (block.kind === "client_other_children") {
    return `Other children · ${block.statusDetail.trim() || "Unrecorded relationship"}`
  }
  if (block.kind === "biological_parents") {
    const status = statusText(block)
    return status ? `Biological parents · ${status}` : "Biological parents"
  }
  if (block.kind === "parent_other") {
    const side = block.parentSide === "father" ? "Father" : "Mother"
    const status = statusText(block) || "Status not recorded"
    const current = !block.endedOn.trim() ? " · current" : ""
    const partner = members(block, people, "partner").find((item) => item.givenName.trim())
    const who = partner ? ` (${partner.givenName.trim()})` : ""
    return `${side}'s other · ${status}${current}${who}`
  }
  const arrangement = arrangementText(block) || "Caregiver arrangement"
  return `Caregiver · ${arrangement}`
}

export function headingFor(block: RelationshipBlock, people: RelationshipRecord[] = []): string {
  if (block.kind === "client_other_children") return otherChildrenHeading(block)
  return moveLabel(block, people)
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
  const ongoing = !block.endedOn.trim()
  if (block.kind === "biological_parents") {
    if (endAge != null) bits.push(`client aged ${endAge}`)
    else if (startAge != null) bits.push(ongoing ? `from client aged ${startAge}` : `client aged ${startAge}`)
  } else if (startAge != null && endAge != null) bits.push(`client aged ${startAge} to ${endAge}`)
  else if (startAge != null) bits.push(ongoing ? `from client aged ${startAge}` : `client aged ${startAge}`)
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

/**
 * Per-section "+ Add relationship" / "+ Add arrangement" on Client Background
 * and interview — opens the shared New relationship form (not AddForm).
 */
export type RelationshipSectionAddSpec = {
  label: string
  kind: BlockKind
  parentSide?: "mother" | "father"
}

export function relationshipSectionAddSpec(sectionTitle: string): RelationshipSectionAddSpec | null {
  if (sectionTitle === "Current intimate relationship and children") {
    return { label: "+ Add relationship", kind: "client_current" }
  }
  if (sectionTitle === "Previous intimate relationships and children") {
    return { label: "+ Add relationship", kind: "client_previous" }
  }
  if (sectionTitle.includes("· other relationships")) {
    if (sectionTitle.startsWith("Mother")) {
      return { label: "+ Add relationship", kind: "parent_other", parentSide: "mother" }
    }
    if (sectionTitle.startsWith("Father")) {
      return { label: "+ Add relationship", kind: "parent_other", parentSide: "father" }
    }
  }
  if (sectionTitle === "Other caregiver arrangements") {
    return { label: "+ Add arrangement", kind: "caregiver_arrangement" }
  }
  return null
}

/** Hide add when the section only shows a none / not-asked note. */
export function relationshipSectionAllowsAdd(children: RelationshipTreeNode[]): boolean {
  if (children.length === 1 && children[0]?.kind === "note") {
    const text = children[0].text.toLowerCase()
    return !(
      text === "none" ||
      text === "not asked" ||
      text === "no children" ||
      text === "no siblings" ||
      text.includes("not asked")
    )
  }
  return true
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
