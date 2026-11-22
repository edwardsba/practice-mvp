import { livingWithClientLines } from "@/lib/client-background/tree"
import {
  CLIENT_RELATIONSHIP_STATUS_LABELS,
  type ClientBackgroundData,
  type ClientRelationshipStatus,
  HOUSING_TYPE_OPTIONS,
  LIVES_WITH_LABELS,
  type LivesWith,
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

function formatChildrenRow(data: ClientBackgroundData): string {
  const children = data.relationships.filter(
    (person) =>
      person.relationshipToClient === "child_biological" ||
      person.relationshipToClient === "child_step"
  )
  if (children.length > 0) {
    return `${children.length} child${children.length === 1 ? "" : "ren"}`
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

function formatLivingRow(data: ClientBackgroundData): string {
  const living = data.demographics.livingSituation
  const housing = living.housingType.trim()
  const housingOk =
    housing &&
    (HOUSING_TYPE_OPTIONS as readonly string[]).includes(housing)
      ? housing
      : housing || ""

  const withPeople = livingWithClientLines(data.relationships)
  let withLine = ""
  if (withPeople.length > 0) {
    // "Mother — Jane" → prefer role words for a short line
    const bits = withPeople.map((line) => {
      const role = line.split(" — ")[0]?.toLowerCase() ?? line
      return role
    })
    withLine = `lives with ${bits.join(" and ")}`
  } else if (living.livesWith) {
    const label =
      LIVES_WITH_LABELS[living.livesWith as LivesWith] ?? living.livesWith
    withLine = label.toLowerCase().startsWith("with")
      ? `lives ${label.toLowerCase()}`
      : label.toLowerCase() === "alone"
        ? "lives alone"
        : label
  }

  if (!housingOk && !withLine) return "Not recorded"
  if (housingOk && withLine) return `${housingOk} · ${withLine}`
  return housingOk || withLine
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
