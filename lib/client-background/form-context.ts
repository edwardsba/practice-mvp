import { CONDITION_CATEGORY_LABELS, EVENT_TYPE_LABELS } from "@/lib/client-background/types"
import type {
  BlockKind,
  ConditionEventType,
  EventType,
  HistoryAbout,
  HistoryIssue,
  RelationshipBlock,
  RelationshipRecord,
} from "@/lib/client-background/types"

/** Where a side-panel form was opened from — drives pre-fill and the context strip. */
export type FormOpenContext = {
  /** Client given name for "About: Tom (client)". */
  clientName: string
  about: HistoryAbout
  /** Named person the entry is about (history Who / relationship subject). */
  person?: RelationshipRecord | null
  /** Free-text Who when not a recorded person. */
  aboutOther?: string
  /** History category (Mental health / Substance use / …). */
  category?: ConditionEventType | EventType | null
  /** Issue under that category. */
  issue?: HistoryIssue | null
  /** Relationship block the form belongs to. */
  block?: RelationshipBlock | null
  /** Section label override, e.g. "other relationships". */
  sectionLabel?: string | null
}

export type ContextStripLine = {
  key: "about" | "for" | "category" | "section"
  /** e.g. "About", "For", "Category" */
  label: string
  /** Plain text after the label, e.g. "Tom (client)" */
  text: string
}

export type ResolvedFormContext = {
  about: HistoryAbout
  relationshipRecordId: string | null
  aboutOther: string
  category: ConditionEventType | EventType | null
  issueId: string | null
  blockId: string | null
  blockKind: BlockKind | null
  parentSide: "mother" | "father" | ""
  lines: ContextStripLine[]
}

function personDisplay(person: RelationshipRecord): string {
  const name = person.givenName.trim() || "Unnamed"
  const role = roleWord(person)
  return role ? `${name} (${role.toLowerCase()})` : name
}

function roleWord(person: RelationshipRecord): string {
  const rel = person.relationshipToClient
  if (rel === "mother" || person.blockRoleType === "mother") return "Mother"
  if (rel === "father" || person.blockRoleType === "father") return "Father"
  if (rel === "step_parent") return "Step-parent"
  if (rel === "current_partner" || rel === "prior_partner" || person.blockRole === "partner") return "Partner"
  if (rel.startsWith("child") || person.blockRole === "child") {
    if (person.sex === "Female") return "Daughter"
    if (person.sex === "Male") return "Son"
    return "Child"
  }
  if (rel.startsWith("sibling") || person.blockRole === "sibling") {
    if (person.sex === "Female") return "Sister"
    if (person.sex === "Male") return "Brother"
    return "Sibling"
  }
  if (rel === "other_caregiver" || person.blockRole === "caregiver") return "Caregiver"
  return ""
}

function categoryLabel(category: ConditionEventType | EventType): string {
  if (category in CONDITION_CATEGORY_LABELS) {
    return CONDITION_CATEGORY_LABELS[category as ConditionEventType]
  }
  return EVENT_TYPE_LABELS[category as EventType] ?? category
}

function sectionForBlock(block: RelationshipBlock, people: RelationshipRecord[]): string {
  if (block.kind === "client_current") return "current relationship"
  if (block.kind === "client_previous") return "previous relationship"
  if (block.kind === "client_other_children") return "other children"
  if (block.kind === "caregiver_arrangement") return "caregiver arrangement"
  if (block.kind === "parent_other") {
    const side = block.parentSide === "father" ? "father" : "mother"
    const parent = people.find(
      (person) =>
        person.relationshipToClient === side ||
        (person.blockRole === "parent" && person.blockRoleType === side)
    )
    const name = parent?.givenName.trim()
    if (name) return `${name} (${side}) · other relationships`
    return `${side} · other relationships`
  }
  if (block.kind === "biological_parents") return "biological parents"
  return "relationship"
}

/**
 * Resolve who / section / category / issue from where the practitioner opened the form.
 * Never re-ask for values that are already known.
 */
export function resolveFormContext(
  open: FormOpenContext,
  people: RelationshipRecord[] = []
): ResolvedFormContext {
  const about = open.about
  const person = open.person ?? null
  const aboutOther = (open.aboutOther ?? "").trim()
  const relationshipRecordId = person?.relationshipRecordId ?? null
  const category = open.category ?? open.issue?.category ?? null
  const issue = open.issue ?? null
  const block = open.block ?? null

  const lines: ContextStripLine[] = []

  if (block) {
    const forText = open.sectionLabel?.trim() || sectionForBlock(block, people)
    // Prefer an explicit person (e.g. Sally) when opening from their line;
    // otherwise the section already names them (mother · other relationships).
    if (person && block.kind !== "parent_other") {
      lines.push({ key: "for", label: "For", text: `${personDisplay(person)} · ${forText}` })
    } else if (person && block.kind === "parent_other") {
      lines.push({ key: "for", label: "For", text: forText.startsWith(person.givenName.trim()) ? forText : `${personDisplay(person)} · ${forText}` })
    } else {
      lines.push({ key: "for", label: "For", text: forText })
    }
  } else {
    // History: About person, then For category › issue (or Category alone for new issue).
    if (about === "self") {
      const name = open.clientName.trim() || "Client"
      lines.push({ key: "about", label: "About", text: `${name} (client)` })
    } else if (person) {
      lines.push({ key: "about", label: "About", text: personDisplay(person) })
    } else if (aboutOther) {
      lines.push({ key: "about", label: "About", text: aboutOther })
    } else {
      lines.push({ key: "about", label: "About", text: "Family and significant others" })
    }

    if (issue && category) {
      const issueTitle = issue.title.trim() || categoryLabel(category)
      lines.push({
        key: "for",
        label: "For",
        text: `${categoryLabel(category)} › ${issueTitle}`,
      })
    } else if (category) {
      lines.push({ key: "category", label: "Category", text: categoryLabel(category) })
    }
  }

  return {
    about,
    relationshipRecordId,
    aboutOther: relationshipRecordId ? "" : aboutOther,
    category,
    issueId: issue?.issueId ?? null,
    blockId: block?.relationshipBlockId ?? null,
    blockKind: block?.kind ?? null,
    parentSide: block?.parentSide === "father" || block?.parentSide === "mother" ? block.parentSide : "",
    lines,
  }
}

/** Format strip lines as a single plain-text summary (tests / read-only). */
export function formatContextStrip(lines: ContextStripLine[]): string {
  return lines.map((line) => `${line.label}: ${line.text}`).join(" · ")
}
