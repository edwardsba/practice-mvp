import {
  CAREGIVER_RELATIONSHIP_LABELS,
  CLIENT_RELATIONSHIP_STATUS_LABELS,
  type ClientBackgroundData,
  type ClientRelationshipStatus,
  HOUSING_TYPE_OPTIONS,
  type RelationshipBlock,
  type RelationshipRecord,
  WORK_STATUS_LABELS,
  type WorkStatus,
} from "@/lib/client-background/types"

export type BackgroundPanelSummary = {
  relationship: string
  children: string
  livingSituation: string
  occupation: string
  history: string
  intakeInterview: string
}

const EMPLOYMENT_SUMMARY: Partial<Record<WorkStatus, string>> = {
  full_time: "Employed full time",
  part_time: "Employed part time",
  casual: "Employed casual",
  self_employed: "Self-employed",
}

function yearOf(value: string): string {
  return /^(\d{4})/.exec(value.trim())?.[1] ?? ""
}

export function livesWithClient(person: RelationshipRecord): boolean {
  return (
    person.livingSituation === "lives_with_client_full_time" ||
    person.livingSituation === "lives_with_client_part_time"
  )
}

function isPartTime(person: RelationshipRecord): boolean {
  return person.livingSituation === "lives_with_client_part_time"
}

function isChildRecord(person: RelationshipRecord): boolean {
  return person.blockRole === "child"
}

function isStepChild(person: RelationshipRecord): boolean {
  return person.blockRoleType === "step_child"
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function withPartTimeSuffix(label: string, people: RelationshipRecord[]): string {
  const partTimeCount = people.filter(isPartTime).length
  if (partTimeCount === 0) return label
  if (people.length === 1) return `${label} (part time)`
  return `${label} (${partTimeCount} part time)`
}

function joinGroups(groups: string[]): string {
  if (groups.length === 0) return ""
  if (groups.length === 1) return groups[0]!
  if (groups.length === 2) return `${groups[0]} and ${groups[1]}`
  return `${groups.slice(0, -1).join(", ")} and ${groups[groups.length - 1]}`
}

function formatRelationshipRow(data: ClientBackgroundData): string {
  const status = data.relationshipStatus.relationshipStatus
  if (!status) return "Not recorded"
  const label =
    status === "other"
      ? data.relationshipStatus.relationshipStatusOther.trim() || "Other"
      : CLIENT_RELATIONSHIP_STATUS_LABELS[status as ClientRelationshipStatus] ??
        status

  const blocks = data.relationshipBlocks ?? []
  const current = blocks.find((block) => block.kind === "client_current")
  const partner = current
    ? data.relationships.find(
        (person) =>
          person.relationshipBlockId === current.relationshipBlockId &&
          person.blockRole === "partner" &&
          person.givenName.trim()
      )
    : null
  const since = current ? yearOf(current.startedOn) : ""

  if (partner?.givenName.trim()) {
    const name = partner.givenName.trim()
    return since ? `${label} to ${name} (since ${since})` : `${label} to ${name}`
  }
  return label
}

function formatChildrenCounts(own: number, step: number): string {
  const parts: string[] = []
  if (own > 0) parts.push(countLabel(own, "child", "children"))
  if (step > 0) parts.push(countLabel(step, "step-child", "step-children"))
  return parts.join(", ")
}

function formatChildrenRow(data: ClientBackgroundData): string {
  const childPeople = data.relationships.filter(isChildRecord)
  if (childPeople.length > 0) {
    const own = childPeople.filter((person) => !isStepChild(person)).length
    const step = childPeople.filter(isStepChild).length
    return formatChildrenCounts(own, step)
  }

  const blocks = data.relationshipBlocks ?? []
  for (const block of blocks) {
    if (
      block.kind === "client_current" ||
      block.kind === "client_previous" ||
      block.kind === "client_other_children"
    ) {
      if (block.childrenAnswer === "none") return "None"
      if (block.childrenAnswer === "not_asked") return "Not asked"
    }
  }
  return "Not recorded"
}

function blockFor(
  person: RelationshipRecord,
  blocks: RelationshipBlock[]
): RelationshipBlock | undefined {
  if (!person.relationshipBlockId) return undefined
  return blocks.find((block) => block.relationshipBlockId === person.relationshipBlockId)
}

/** Partner wording used by the Relationships section (wife / husband / partner). */
function partnerRoleWord(
  person: RelationshipRecord,
  block: RelationshipBlock | undefined,
  relationshipStatus?: string | null
): string {
  const sex = person.sex.trim().toLowerCase()
  const married =
    (block?.kind === "client_current" && block.status === "married") ||
    relationshipStatus === "married"
  if (married) {
    if (sex === "female") return "wife"
    if (sex === "male") return "husband"
  }
  return "partner"
}

function formatPartnerGroup(
  partners: RelationshipRecord[],
  blocks: RelationshipBlock[],
  relationshipStatus?: string | null
): string | null {
  if (partners.length === 0) return null
  if (partners.length === 1) {
    const person = partners[0]!
    const word = partnerRoleWord(person, blockFor(person, blocks), relationshipStatus)
    return withPartTimeSuffix(word, partners)
  }
  return withPartTimeSuffix(countLabel(partners.length, "partner", "partners"), partners)
}

function formatChildLivingGroup(children: RelationshipRecord[], step: boolean): string | null {
  if (children.length === 0) return null
  const label = step
    ? countLabel(children.length, "step-child", "step-children")
    : countLabel(children.length, "child", "children")
  return withPartTimeSuffix(label, children)
}

function isMother(person: RelationshipRecord): boolean {
  return person.blockRoleType === "mother" || person.relationshipToClient === "mother"
}

function isFather(person: RelationshipRecord): boolean {
  return person.blockRoleType === "father" || person.relationshipToClient === "father"
}

function caregiverRoleWord(person: RelationshipRecord): string {
  const detail = person.caregiverRelationshipDetail.trim()
  if (detail) {
    const lower = detail.toLowerCase()
    // Prefer a short role when the detail is like "maternal grandmother"
    if (lower.includes("grandmother")) return "grandmother"
    if (lower.includes("grandfather")) return "grandfather"
    if (lower.includes("grandparent")) return "grandparent"
    return lower
  }
  const key = (person.blockRoleType || person.caregiverRelationship || "").trim()
  if (key && key in CAREGIVER_RELATIONSHIP_LABELS) {
    return CAREGIVER_RELATIONSHIP_LABELS[key as keyof typeof CAREGIVER_RELATIONSHIP_LABELS].toLowerCase()
  }
  return "caregiver"
}

function formatParentsCaregiversGroup(people: RelationshipRecord[]): string | null {
  const parents = people.filter((person) => person.blockRole === "parent")
  const caregivers = people.filter((person) => person.blockRole === "caregiver")
  if (parents.length === 0 && caregivers.length === 0) return null

  const parts: string[] = []

  if (parents.length > 0) {
    const mothers = parents.filter(isMother)
    const fathers = parents.filter(isFather)
    let parentLabel: string
    if (parents.length === 1 && mothers.length === 1) parentLabel = "mother"
    else if (parents.length === 1 && fathers.length === 1) parentLabel = "father"
    else if (mothers.length >= 1 && fathers.length >= 1 && mothers.length + fathers.length === parents.length) {
      parentLabel = "both parents"
    } else {
      parentLabel = countLabel(parents.length, "parent", "parents")
    }
    parts.push(parentLabel)
  }

  if (caregivers.length === 1) {
    parts.push(caregiverRoleWord(caregivers[0]!))
  } else if (caregivers.length > 1) {
    parts.push(countLabel(caregivers.length, "caregiver", "caregivers"))
  }

  const label = joinGroups(parts)
  return withPartTimeSuffix(label, [...parents, ...caregivers])
}

function formatSiblingGroup(siblings: RelationshipRecord[]): string | null {
  if (siblings.length === 0) return null
  return withPartTimeSuffix(
    countLabel(siblings.length, "sibling", "siblings"),
    siblings
  )
}

function otherRoleWord(person: RelationshipRecord): string {
  const detail = person.caregiverRelationshipDetail.trim().toLowerCase()
  if (detail) return detail
  const key = (person.blockRoleType || person.caregiverRelationship || "").trim()
  if (key) return key.replaceAll("_", " ").toLowerCase()
  const legacy = person.relationshipToClient.replaceAll("_", " ").trim().toLowerCase()
  if (legacy) return legacy
  return "other"
}

function formatOthersGroup(others: RelationshipRecord[]): string | null {
  if (others.length === 0) return null
  if (others.length === 1) {
    const word = otherRoleWord(others[0]!)
    const label = word === "other" ? "1 other" : word
    return withPartTimeSuffix(label, others)
  }
  const roles = others.map(otherRoleWord)
  const unique = new Set(roles)
  if (unique.size === 1) {
    const role = roles[0]!
    if (role !== "other") {
      // e.g. "2 housemates" when every other person shares a clear role
      const plural = role.endsWith("s") ? role : `${role}s`
      return withPartTimeSuffix(`${others.length} ${plural}`, others)
    }
  }
  return withPartTimeSuffix(countLabel(others.length, "other", "others"), others)
}

export function formatLivesWithGroups(
  people: RelationshipRecord[],
  blocks: RelationshipBlock[],
  relationshipStatus?: string | null
): string {
  const living = people.filter(livesWithClient)
  const partners = living.filter((person) => person.blockRole === "partner")
  const children = living.filter((person) => isChildRecord(person) && !isStepChild(person))
  const stepChildren = living.filter((person) => isChildRecord(person) && isStepChild(person))
  const parentsCaregivers = living.filter(
    (person) => person.blockRole === "parent" || person.blockRole === "caregiver"
  )
  const siblings = living.filter((person) => person.blockRole === "sibling")
  const used = new Set(
    [...partners, ...children, ...stepChildren, ...parentsCaregivers, ...siblings].map(
      (person) => person.relationshipRecordId
    )
  )
  const others = living.filter((person) => !used.has(person.relationshipRecordId))

  const groups = [
    formatPartnerGroup(partners, blocks, relationshipStatus),
    formatChildLivingGroup(children, false),
    formatChildLivingGroup(stepChildren, true),
    formatParentsCaregiversGroup(parentsCaregivers),
    formatSiblingGroup(siblings),
    formatOthersGroup(others),
  ].filter((group): group is string => Boolean(group))

  return joinGroups(groups)
}

function housingLabel(data: ClientBackgroundData): string {
  const housing = data.demographics.livingSituation.housingType.trim()
  if (
    housing &&
    (HOUSING_TYPE_OPTIONS as readonly string[]).includes(housing)
  ) {
    return housing
  }
  return housing || ""
}

/**
 * Report-style "lives with …" who-clause (no "lives with" prefix).
 * Reuses people grouping helpers; lumps all children (incl. step) as "children"
 * so Tom's letter stays "wife and children".
 */
export function formatReportLivesWithClause(
  people: RelationshipRecord[],
  blocks: RelationshipBlock[],
  othersInHome: Array<{ who: string }> = [],
  relationshipStatus?: string | null
): string {
  const living = people.filter(livesWithClient)
  const partners = living.filter((person) => person.blockRole === "partner")
  const children = living.filter((person) => isChildRecord(person))
  const parentsCaregivers = living.filter(
    (person) => person.blockRole === "parent" || person.blockRole === "caregiver"
  )
  const siblings = living.filter((person) => person.blockRole === "sibling")
  const used = new Set(
    [...partners, ...children, ...parentsCaregivers, ...siblings].map(
      (person) => person.relationshipRecordId
    )
  )
  const others = living.filter((person) => !used.has(person.relationshipRecordId))

  const groups: string[] = []
  const partnerGroup = formatPartnerGroup(partners, blocks, relationshipStatus)
  if (partnerGroup) groups.push(partnerGroup)
  if (children.length === 1) groups.push("child")
  else if (children.length > 1) groups.push("children")
  const parentsGroup = formatParentsCaregiversGroup(parentsCaregivers)
  if (parentsGroup) groups.push(parentsGroup)
  const siblingGroup = formatSiblingGroup(siblings)
  if (siblingGroup) groups.push(siblingGroup)
  const othersGroup = formatOthersGroup(others)
  if (othersGroup) groups.push(othersGroup)
  for (const other of othersInHome) {
    const who = other.who.trim()
    if (who) groups.push(who)
  }
  return joinGroups(groups)
}

function formatLivingRow(data: ClientBackgroundData): string {
  const living = data.demographics.livingSituation
  const housing = housingLabel(data)
  const livingPeople = data.relationships.filter(livesWithClient)
  const othersLabels = (living.othersInHome ?? [])
    .map((row) => row.who.trim())
    .filter(Boolean)

  let withLine = ""
  if (livingPeople.length > 0 || othersLabels.length > 0) {
    const peoplePart = livingPeople.length
      ? formatLivesWithGroups(
          data.relationships,
          data.relationshipBlocks ?? [],
          data.relationshipStatus.relationshipStatus
        )
      : ""
    const othersPart = othersLabels.length ? joinGroups(othersLabels) : ""
    const joined =
      peoplePart && othersPart
        ? joinGroups([peoplePart, othersPart])
        : peoplePart || othersPart
    withLine = `lives with ${joined}`
  } else if (living.household === "alone") {
    withLine = "lives alone"
  } else if (living.household === "no_fixed_address") {
    withLine = "no fixed address"
  }
  // Nobody marked as living with the client and not alone: housing type only.

  if (!housing && !withLine) return "Not recorded"
  if (housing && withLine) return `${housing} · ${withLine}`
  return housing || withLine
}

function formatOccupationRow(data: ClientBackgroundData): string {
  const work = data.demographics.occupation
  const status = work.workStatus
  if (!status) return "Not recorded"
  const statusLabel =
    EMPLOYMENT_SUMMARY[status] ??
    WORK_STATUS_LABELS[status as WorkStatus] ??
    status
  const role = work.role.trim()
  if (role) return `${statusLabel} · ${role}`
  return statusLabel
}

function formatHistoryRow(data: ClientBackgroundData): string {
  const titles = (data.issues ?? [])
    .filter((issue) => issue.about !== "significant_other")
    .map((issue) => issue.title.trim())
    .filter(Boolean)
  if (titles.length === 0) return "None recorded"
  if (titles.length <= 3) return titles.join(", ")
  const shown = titles.slice(0, 3)
  const more = titles.length - 3
  return `${shown.join(", ")} · + ${more} more`
}

function formatIntakeRow(data: ClientBackgroundData): string {
  if (!data.backgroundCapturedAt) return "Not yet completed"
  const date = new Date(data.backgroundCapturedAt)
  if (Number.isNaN(date.getTime())) return "Completed"
  const label = date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  return `Completed ${label}`
}

/** Client-page Background and history panel summary rows. */
export function buildBackgroundPanelSummary(
  data: ClientBackgroundData | null | undefined
): BackgroundPanelSummary {
  if (!data) {
    return {
      relationship: "Not recorded",
      children: "Not recorded",
      livingSituation: "Not recorded",
      occupation: "Not recorded",
      history: "None recorded",
      intakeInterview: "Not yet completed",
    }
  }
  return {
    relationship: formatRelationshipRow(data),
    children: formatChildrenRow(data),
    livingSituation: formatLivingRow(data),
    occupation: formatOccupationRow(data),
    history: formatHistoryRow(data),
    intakeInterview: formatIntakeRow(data),
  }
}
