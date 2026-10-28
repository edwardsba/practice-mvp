import { eventsForQuestion, historyQuestionAcceptsEntries, HISTORY_QUESTION_KEYS, HISTORY_QUESTIONS, type ScreeningAnswers } from "@/lib/client-background/interview-history"
import { needsLinkingItems } from "@/lib/client-background/relationship-groups"
import { buildRelationshipTree, personRoleLabel } from "@/lib/client-background/tree"
import {
  CLIENT_RELATIONSHIP_STATUS_LABELS,
  EMPLOYED_WORK_STATUSES,
  LIVES_WITH_LABELS,
  WORK_STATUS_LABELS,
  type ClientBackgroundData,
  type ClientRelationshipStatus,
  type LivesWith,
  type RelationshipRecord,
  type RelationshipToClient,
} from "@/lib/client-background/types"

export type BackgroundCheckTarget =
  | "identity"
  | "occupation"
  | "living"
  | "relationships"
  | "medication"
  | "history"

export type BackgroundCheck = {
  id: string
  message: string
  target: BackgroundCheckTarget
}

export type BackgroundCheckInput = {
  data: ClientBackgroundData
  /** Latest self-report answer. Null when the client has no self-report, or left the question blank. */
  numberOfChildren: number | null
  /** Latest interview's screening answers. Null when there has been no interview. */
  screening: ScreeningAnswers | null
}

const PARTNER_EXPECTED: readonly ClientRelationshipStatus[] = [
  "in_relationship_not_living_together",
  "engaged",
  "defacto",
  "married",
]

const PARTNER_UNEXPECTED: readonly ClientRelationshipStatus[] = ["single", "separated", "divorced", "widowed"]

const LIVES_WITH_KINDS: Partial<Record<LivesWith, readonly RelationshipToClient[]>> = {
  with_partner: ["current_partner"],
  with_partner_and_children: ["current_partner", "child_biological", "child_step"],
  with_children_sole_parent: ["child_biological", "child_step"],
  with_parents: ["mother", "father", "parent", "step_parent"],
}

/** Client Background accordion that holds this check's interview section. */
export function backgroundSectionForCheck(
  target: BackgroundCheckTarget
): "reason" | "demographics" | "relationships" | "history" {
  if (target === "relationships") return "relationships"
  if (target === "history") return "history"
  return "demographics"
}

export function interviewPageForCheck(target: BackgroundCheckTarget): "background" | "history" {
  return target === "history" ? "history" : "background"
}

/** Specific anchor first, then the section anchor. */
export function checkElementIds(check: BackgroundCheck): string[] {
  const specific = `check-${check.id}`
  const section = `check-${check.target}`
  return specific === section ? [section] : [specific, section]
}

function markedLivingWith(person: RelationshipRecord): boolean {
  return (
    person.livingSituation === "lives_with_client_full_time" ||
    person.livingSituation === "lives_with_client_part_time"
  )
}

function linkingWhat(action: string): string {
  const core = action.replace(/^Choose\s+/, "").replace(/\s*›\s*$/, "").trim()
  return core ? `a ${core}` : "a record"
}

export function backgroundChecks(input: BackgroundCheckInput): BackgroundCheck[] {
  const { data } = input
  const checks: BackgroundCheck[] = []
  const status = data.relationshipStatus.relationshipStatus
  const hasCurrentPartner = data.relationships.some((person) => person.relationshipToClient === "current_partner")

  if (status && (PARTNER_EXPECTED as readonly string[]).includes(status) && !hasCurrentPartner) {
    checks.push({
      id: "partner-missing",
      message: `Relationship status is ${CLIENT_RELATIONSHIP_STATUS_LABELS[status]}, but no current partner is recorded.`,
      target: "relationships",
    })
  }
  if (status && (PARTNER_UNEXPECTED as readonly string[]).includes(status) && hasCurrentPartner) {
    checks.push({
      id: "partner-unexpected",
      message: `Relationship status is ${CLIENT_RELATIONSHIP_STATUS_LABELS[status]}, but a current partner is recorded.`,
      target: "relationships",
    })
  }

  if (input.numberOfChildren != null) {
    const recorded = data.relationships.filter(
      (person) => person.relationshipToClient === "child_biological" || person.relationshipToClient === "child_step"
    ).length
    if (recorded !== input.numberOfChildren) {
      checks.push({
        id: "children-count",
        message: `Client reported ${input.numberOfChildren} children; ${recorded} recorded.`,
        target: "relationships",
      })
    }
  }

  const livesWith = data.demographics.livingSituation.livesWith
  const kinds = livesWith ? LIVES_WITH_KINDS[livesWith] : undefined
  if (livesWith && kinds && !data.relationships.some((person) => kinds.includes(person.relationshipToClient) && markedLivingWith(person))) {
    checks.push({
      id: "lives-with",
      message: `Lives with ${LIVES_WITH_LABELS[livesWith].replace(/^With /, "")}, but no one is marked as living with the client.`,
      target: "living",
    })
  }

  const work = data.demographics.occupation
  if (
    work.workStatus &&
    (EMPLOYED_WORK_STATUSES as readonly string[]).includes(work.workStatus) &&
    !work.role.trim()
  ) {
    checks.push({
      id: "work-role",
      message: `Work status is ${WORK_STATUS_LABELS[work.workStatus]}, but no role is recorded.`,
      target: "occupation",
    })
  }
  if (work.workStatus === "unemployed" && work.previousJobs.length === 0) {
    checks.push({
      id: "work-previous",
      message: "Unemployed, but no previous job is recorded.",
      target: "occupation",
    })
  }

  if (input.screening) {
    for (const key of HISTORY_QUESTION_KEYS) {
      if (!historyQuestionAcceptsEntries(key)) continue
      if (input.screening[key] !== "yes") continue
      if (eventsForQuestion(data.events, key, data.dateOfBirth).length > 0) continue
      checks.push({
        id: `history-${key}`,
        message: `${HISTORY_QUESTIONS[key].label} is Yes, with no entries.`,
        target: "history",
      })
    }
  }

  if (data.medication.currentlyTaking === "yes" && !data.medication.supervisedBy.trim()) {
    checks.push({
      id: "medication-supervisor",
      message: "Currently taking medication, but no supervisor is recorded.",
      target: "medication",
    })
  }

  if (data.demographics.identity.disability === true && !data.demographics.identity.disabilityDetail.trim()) {
    checks.push({
      id: "disability",
      message: "Disability is Yes, with no description.",
      target: "identity",
    })
  }

  const tree = buildRelationshipTree(data.relationships, data.partnerships)
  for (const item of needsLinkingItems(tree)) {
    const relationship = personRoleLabel(item.person)
    const name = item.person.givenName.trim()
    const subject = name ? `${relationship} ${name}` : relationship
    checks.push({
      id: `linking-${item.person.relationshipRecordId}`,
      message: `${subject} needs linking to ${linkingWhat(item.action)}.`,
      target: "relationships",
    })
  }

  return checks
}
