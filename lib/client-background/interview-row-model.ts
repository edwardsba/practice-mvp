/**
 * What one Background interview lined row shows (Round AR): the on-file value lines with the
 * client's self-report answers merged in.
 *
 * - same → only the purple "Client: …" line, inside the value
 * - empty / different, not yet decided → purple line with Use client's, then what's on file
 *   (or "not recorded") with Keep
 * - decided (Use client's / Keep), or no client answer → what's on file only
 *
 * Pure — no database.
 */

import {
  clientFieldDisplayLabel,
  clientFieldTitle,
  isClientFieldNamedByRow,
  type ClientFieldKey,
  type ClientFieldState,
} from "@/lib/client-background/interview-client-fields"
import type { InterviewValueLine } from "@/lib/client-background/interview-facts"

/** A client answer still waiting for Use client's / Keep. */
export type InterviewClientChoice = {
  fieldKey: ClientFieldKey
  /** Text after "Client: ". */
  clientLabel: string
  /** What's on file for this field, worded like its fact line; empty when nothing is recorded. */
  fileText: string
  /** Shown instead of fileText when nothing is recorded ("Sex: not recorded" / "Not recorded"). */
  emptyText: string
  /** Field name for accessible button labels ("Pronouns"). */
  title: string
}

export type InterviewValuePart =
  | { kind: "file"; text: string }
  /** `text` follows "Client: ". Use client's / Keep when fieldKey is set. */
  | { kind: "client"; fieldKey: ClientFieldKey; text: string }
  /** Display-only Client: line (no Use client's / Keep). */
  | { kind: "client_info"; text: string }

export type InterviewRowModel = {
  choices: InterviewClientChoice[]
  value: InterviewValuePart[]
}

const NOT_RECORDED = "Not recorded"

/** Plain fact lines (sections 1, 2 and 4), minus bare "Not recorded" placeholders. */
export function plainValueLines(lines: readonly string[] | null | undefined): InterviewValueLine[] {
  return (lines ?? [])
    .filter((text) => text.trim() && text.trim() !== NOT_RECORDED)
    .map((text) => ({ text, fields: [] }))
}

export function interviewRowModel(
  lines: readonly InterviewValueLine[],
  states: readonly ClientFieldState[],
  fileText: (fieldKey: ClientFieldKey) => string
): InterviewRowModel {
  const choices: InterviewClientChoice[] = states
    .filter((state) => state.waiting)
    .map((state) => ({
      fieldKey: state.fieldKey,
      clientLabel: clientFieldDisplayLabel(state.fieldKey, state.label),
      fileText: state.kind === "different" ? fileText(state.fieldKey) : "",
      emptyText: isClientFieldNamedByRow(state.fieldKey)
        ? NOT_RECORDED
        : `${clientFieldTitle(state.fieldKey)}: not recorded`,
      title: clientFieldTitle(state.fieldKey),
    }))
  const paired = new Set(choices.map((choice) => choice.fieldKey))
  const same = states.filter((state) => state.kind === "same")
  const sameKeys = new Set(same.map((state) => state.fieldKey))
  const shown = new Set<ClientFieldKey>()
  const onFileLine = new Set<ClientFieldKey>()
  const value: InterviewValuePart[] = []

  function pushClient(fieldKey: ClientFieldKey) {
    const state = same.find((entry) => entry.fieldKey === fieldKey)
    if (!state || shown.has(fieldKey)) return
    value.push({ kind: "client", fieldKey, text: clientFieldDisplayLabel(fieldKey, state.label) })
    shown.add(fieldKey)
  }

  for (const entry of lines) {
    const exact = entry.exact !== false
    const replaced =
      entry.fields.length > 0 &&
      entry.fields.every((field) => paired.has(field) || (exact && sameKeys.has(field)))
    if (replaced) {
      for (const field of entry.fields) pushClient(field)
      continue
    }
    value.push({ kind: "file", text: entry.text })
    if (exact) for (const field of entry.fields) onFileLine.add(field)
  }
  for (const state of same) {
    if (!onFileLine.has(state.fieldKey)) pushClient(state.fieldKey)
  }
  return { choices, value }
}

/** Visible text of a value, for "Edit [label], [value]". */
export function valuePartsText(parts: readonly InterviewValuePart[]): string {
  return parts
    .map((part) =>
      part.kind === "client" || part.kind === "client_info" ? `Client: ${part.text}` : part.text
    )
    .join(", ")
}

export function editValueAriaLabel(rowLabel: string, valueText: string): string {
  return valueText.trim() ? `Edit ${rowLabel}, ${valueText}` : `Edit ${rowLabel}, not recorded`
}
