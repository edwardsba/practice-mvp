import { needLabel, needsForBlock, needsForMember, isPartneredClientStatus } from "@/lib/client-background/relationship-blocks"
import { entryDetailMessage, unlinkedTreatmentMessage } from "@/lib/client-background/history-links"
import { eventsForQuestion, historyQuestionAcceptsEntries, historyQuestionCheckLabel, HISTORY_QUESTION_KEYS, type ScreeningAnswers } from "@/lib/client-background/interview-history"
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
  | "reason"
  | "identity"
  | "occupation"
  | "living"
  | "relationships"
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
  "dating",
  "defacto",
  "married",
]

const ENDED_STATUS_CODE: Partial<Record<ClientRelationshipStatus, "separated" | "divorced" | "partner_died">> = {
  separated: "separated",
  divorced: "divorced",
  widowed: "partner_died",
}

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
  if (target === "reason") return "reason"
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

export function backgroundChecks(input: BackgroundCheckInput): BackgroundCheck[] {
  const { data } = input
  const checks: BackgroundCheck[] = []
  if (!data.reason.referralType) {
    checks.push({
      id: "referral-type",
      message: "Referral type not recorded",
      target: "reason",
    })
  }
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

  const blocks = data.relationshipBlocks ?? []
  const endedCode =
    status === "separated" || status === "divorced" || status === "widowed" ? ENDED_STATUS_CODE[status] : undefined
  if (status && endedCode) {
    const matched = blocks.some((block) => {
      if (block.kind !== "client_previous") return false
      if (endedCode === "separated") return block.status === "married_separated" || block.status === "defacto_separated"
      if (endedCode === "divorced") return block.status === "divorced"
      return block.status === "widowed" || block.status === "partner_died"
    })
    if (!matched) {
      checks.push({
        id: "partner-ended",
        message: `Relationship status is ${CLIENT_RELATIONSHIP_STATUS_LABELS[status]}, but no previous relationship has a matching ending.`,
        target: "relationships",
      })
    }
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
        message: `${historyQuestionCheckLabel(key)} is Yes, with no entries.`,
        target: "history",
      })
    }
  }

  if (data.demographics.identity.disability === true && !data.demographics.identity.disabilityDetail.trim()) {
    checks.push({
      id: "disability",
      message: "Disability is Yes, with no description.",
      target: "identity",
    })
  }

  for (const event of data.events) {
    const detail = entryDetailMessage(event, data.dateOfBirth)
    if (detail) {
      checks.push({ id: `detail-${event.eventRecordId}`, message: detail, target: "history" })
    }
    const unlinked = unlinkedTreatmentMessage(event)
    if (unlinked) {
      checks.push({ id: `unlinked-${event.eventRecordId}`, message: unlinked, target: "history" })
    }
  }

  if (blocks.length > 0) {
    const current = blocks.filter((block) => block.kind === "client_current").sort((a, b) => a.displayOrder - b.displayOrder)
    const lockedId = isPartneredClientStatus(status) ? current[0]?.relationshipBlockId ?? null : null
    for (const block of blocks) {
      const title =
        block.kind === "client_current"
          ? "Current relationship"
          : block.kind === "client_previous"
            ? "Previous relationship"
            : block.kind === "caregiver_arrangement" && block.arrangementType === "adoption"
              ? "Adoption"
              : "Relationship"
      for (const need of needsForBlock(block, block.relationshipBlockId === lockedId)) {
        checks.push({
          id: `block-${block.relationshipBlockId}-${need}`,
          message: `${title}: ${needLabel(need).toLowerCase()}`,
          target: "relationships",
        })
      }
      for (const person of data.relationships.filter((item) => item.relationshipBlockId === block.relationshipBlockId)) {
        const name = person.givenName.trim()
        for (const need of needsForMember(block, person)) {
          checks.push({
            id: `member-${person.relationshipRecordId}-${need}`,
            message: `${name || person.blockRole || "Person"}: ${needLabel(need).toLowerCase()}`,
            target: "relationships",
          })
        }
      }
    }
    for (const person of data.relationships) {
      if (person.placementReview !== "unplaced" && person.relationshipBlockId) continue
      if (person.relationshipBlockId) continue
      const name = person.givenName.trim()
      checks.push({
        id: `unplaced-${person.relationshipRecordId}`,
        message: name ? `${name} could not be placed in a relationship.` : "A person could not be placed in a relationship.",
        target: "relationships",
      })
    }
    for (const person of data.relationships) {
      if (person.placementReview !== "unlinked_child") continue
      const name = person.givenName.trim()
      checks.push({
        id: `unlinked-child-${person.relationshipRecordId}`,
        message: name ? `Child ${name} was not linked to a partner.` : "A child was not linked to a partner.",
        target: "relationships",
      })
    }
  }

  return checks
}
