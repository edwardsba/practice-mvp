/**
 * Person-list and history-list entry parsing, and the shared "in person" option.
 * Pure — no database.
 */

export const IN_PERSON_VALUE = "in_person"
export const IN_PERSON_LABEL = "I'd rather talk about it in person"

export const PERSON_LIST_FIELD_KEYS = [
  "firstName",
  "age",
  "relationship",
  "livesWith",
  "fromYear",
  "toYear",
  "howEnded",
  "passedAway",
  "deathYear",
] as const

export type PersonListFieldKey = (typeof PERSON_LIST_FIELD_KEYS)[number]

export const HISTORY_LIST_FIELD_KEYS = ["what", "when"] as const
export type HistoryListFieldKey = (typeof HISTORY_LIST_FIELD_KEYS)[number]

export type FormListFieldLabelKey = PersonListFieldKey | HistoryListFieldKey

export type FormListChoice = {
  label: string
  value: string
}

/** Default field labels when the definition omits `labels`. */
export const DEFAULT_LIST_FIELD_LABELS: Record<FormListFieldLabelKey, string> = {
  firstName: "First name",
  age: "Age",
  relationship: "Relationship",
  livesWith: "Lives with you?",
  fromYear: "From year",
  toYear: "To year",
  howEnded: "How it ended",
  passedAway: "Passed away",
  deathYear: "Year they passed away (if you know)",
  what: "What",
  when: "When",
}

/** Config for person_list / history_list on an assessment element. */
export type FormListConfig = {
  /** Dashed "+ Add …" button label. */
  addButtonLabel: string
  /**
   * person_list: which fields each entry shows, from the fixed set.
   * history_list: ignored (always what + when).
   */
  fields?: PersonListFieldKey[]
  /** Choices for the relationship radio (person_list). */
  relationshipChoices?: FormListChoice[]
  /** Choices for howEnded (person_list). */
  howEndedChoices?: FormListChoice[]
  /** Optional field labels (client vs practitioner wording). Unknown keys dropped. */
  labels?: Partial<Record<FormListFieldLabelKey, string>>
}

export type PersonListEntry = {
  firstName?: string
  age?: number
  relationship?: string
  livesWith?: "yes" | "no"
  fromYear?: number
  toYear?: number
  howEnded?: string
  /** Present only when ticked; missing otherwise. */
  passedAway?: true
  /** Year of death; kept only when passedAway is true. */
  deathYear?: number
}

export type HistoryListEntry = {
  what?: string
  when?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asIntInRange(value: unknown, min: number, max: number): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) {
    return value
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    if (Number.isInteger(n) && n >= min && n <= max) return n
  }
  return undefined
}

function choiceValue(
  value: unknown,
  choices: readonly FormListChoice[] | undefined
): string | undefined {
  const raw = asTrimmedString(value)
  if (!raw) return undefined
  if (!choices || choices.length === 0) return raw
  return choices.some((c) => c.value === raw) ? raw : undefined
}

function choiceLabel(
  value: string | undefined,
  choices: readonly FormListChoice[] | undefined
): string | undefined {
  if (!value) return undefined
  return choices?.find((c) => c.value === value)?.label ?? value
}

const LABEL_KEYS = new Set<string>([
  ...(PERSON_LIST_FIELD_KEYS as readonly string[]),
  ...(HISTORY_LIST_FIELD_KEYS as readonly string[]),
])

/** Current calendar year (for deathYear upper bound). */
export function currentCalendarYear(now: Date = new Date()): number {
  return now.getFullYear()
}

/** Label for a list field: definition override, else the shared default. */
export function listFieldLabel(
  config: FormListConfig | null | undefined,
  key: FormListFieldLabelKey
): string {
  const custom = config?.labels?.[key]
  if (typeof custom === "string" && custom.trim()) return custom.trim()
  return DEFAULT_LIST_FIELD_LABELS[key]
}

/**
 * Tick or untick passedAway. Age is kept when ticked (label becomes
 * "Age when they passed away" in the editor). Unticking clears deathYear.
 */
export function setPersonPassedAway(entry: PersonListEntry, passedAway: boolean): PersonListEntry {
  const next = { ...entry }
  if (passedAway) {
    next.passedAway = true
  } else {
    delete next.passedAway
    delete next.deathYear
  }
  return next
}

/** Collapsed "passed away …" phrase for the one-line summary. */
export function formatPassedAwayPhrase(entry: PersonListEntry): string {
  const year = entry.deathYear
  const age = entry.age
  if (year != null && age != null) return `passed away in ${year} aged ${age}`
  if (age != null) return `passed away aged ${age}`
  if (year != null) return `passed away in ${year}`
  return "passed away"
}

/** Parse one person_list JSON string; drop unknown keys and bad values. */
export function parsePersonListEntry(
  raw: string,
  config: FormListConfig | null | undefined
): PersonListEntry | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null

  const fields = new Set(
    (config?.fields ?? PERSON_LIST_FIELD_KEYS).filter((key) =>
      (PERSON_LIST_FIELD_KEYS as readonly string[]).includes(key)
    )
  )
  const entry: PersonListEntry = {}

  if (fields.has("firstName")) {
    const firstName = asTrimmedString(parsed.firstName)
    if (firstName) entry.firstName = firstName
  }
  if (fields.has("passedAway") && parsed.passedAway === true) {
    entry.passedAway = true
  }
  if (fields.has("age")) {
    const age = asIntInRange(parsed.age, 0, 120)
    if (age !== undefined) entry.age = age
  }
  if (fields.has("deathYear") && entry.passedAway === true) {
    const deathYear = asIntInRange(parsed.deathYear, 1900, currentCalendarYear())
    if (deathYear !== undefined) entry.deathYear = deathYear
  }
  if (fields.has("relationship")) {
    const relationship = choiceValue(parsed.relationship, config?.relationshipChoices)
    if (relationship) entry.relationship = relationship
  }
  if (fields.has("livesWith")) {
    const livesWith = asTrimmedString(parsed.livesWith)
    if (livesWith === "yes" || livesWith === "no") entry.livesWith = livesWith
  }
  if (fields.has("fromYear")) {
    const fromYear = asIntInRange(parsed.fromYear, 1000, 9999)
    if (fromYear !== undefined) entry.fromYear = fromYear
  }
  if (fields.has("toYear")) {
    const toYear = asIntInRange(parsed.toYear, 1000, 9999)
    if (toYear !== undefined) entry.toYear = toYear
  }
  if (fields.has("howEnded")) {
    const howEnded = choiceValue(parsed.howEnded, config?.howEndedChoices)
    if (howEnded) entry.howEnded = howEnded
  }

  return isPersonEntryBlank(entry) ? null : entry
}

export function isPersonEntryBlank(entry: PersonListEntry): boolean {
  return (
    entry.firstName == null &&
    entry.age == null &&
    entry.relationship == null &&
    entry.livesWith == null &&
    entry.fromYear == null &&
    entry.toYear == null &&
    entry.howEnded == null &&
    entry.passedAway !== true &&
    entry.deathYear == null
  )
}

/** Parse one history_list JSON string; drop unknown keys and blank entries. */
export function parseHistoryListEntry(raw: string): HistoryListEntry | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  const entry: HistoryListEntry = {}
  const what = asTrimmedString(parsed.what)
  const when = asTrimmedString(parsed.when)
  if (what) entry.what = what
  if (when) entry.when = when
  return entry.what == null && entry.when == null ? null : entry
}

export function isHistoryEntryBlank(entry: HistoryListEntry): boolean {
  return entry.what == null && entry.when == null
}

export function serializePersonListEntry(entry: PersonListEntry): string {
  return JSON.stringify(entry)
}

export function serializeHistoryListEntry(entry: HistoryListEntry): string {
  return JSON.stringify(entry)
}

/** Drop blank / invalid person_list JSON strings; re-serialize cleaned entries. */
export function cleanPersonListValues(
  values: string[] | undefined,
  config: FormListConfig | null | undefined
): string[] {
  if (!values) return []
  const out: string[] = []
  for (const raw of values) {
    if (typeof raw !== "string" || !raw.trim()) continue
    const entry = parsePersonListEntry(raw, config)
    if (entry) out.push(serializePersonListEntry(entry))
  }
  return out
}

export function cleanHistoryListValues(values: string[] | undefined): string[] {
  if (!values) return []
  const out: string[] = []
  for (const raw of values) {
    if (typeof raw !== "string" || !raw.trim()) continue
    const entry = parseHistoryListEntry(raw)
    if (entry) out.push(serializeHistoryListEntry(entry))
  }
  return out
}

/** Who reads the collapsed person line — livesWith wording differs. */
export type PersonListAudience = "client" | "readonly"

/** Collapsed person line: name, then muted facts joined with " · ". */
export function formatPersonListEntryLine(
  entry: PersonListEntry,
  config: FormListConfig | null | undefined,
  audience: PersonListAudience = "readonly"
): { name: string; details: string } {
  const name = entry.firstName?.trim() || "Unnamed"
  const bits: string[] = []
  if (entry.passedAway !== true && entry.age != null) bits.push(String(entry.age))
  const relationship = choiceLabel(entry.relationship, config?.relationshipChoices)
  if (relationship) bits.push(relationship)
  if (entry.passedAway === true) bits.push(formatPassedAwayPhrase(entry))
  if (entry.livesWith === "yes") {
    bits.push(audience === "client" ? "lives with you" : "lives with client")
  }
  if (entry.livesWith === "no") {
    bits.push(audience === "client" ? "doesn't live with you" : "doesn't live with client")
  }
  if (entry.fromYear != null && entry.toYear != null) {
    bits.push(`${entry.fromYear}–${entry.toYear}`)
  } else if (entry.fromYear != null) {
    bits.push(`since ${entry.fromYear}`)
  } else if (entry.toYear != null) {
    bits.push(`until ${entry.toYear}`)
  }
  const howEnded = choiceLabel(entry.howEnded, config?.howEndedChoices)
  if (howEnded) bits.push(howEnded)
  return { name, details: bits.join(" · ") }
}

/** Collapsed history line: "Depression · from about age 25". */
export function formatHistoryListEntryLine(entry: HistoryListEntry): string {
  const what = entry.what?.trim() || "Untitled"
  const when = entry.when?.trim()
  if (!when) return what
  return `${what} · from ${when}`
}

/**
 * "+ Add a parent or carer" → "+ Add another parent or carer" once the list
 * already has an entry.
 */
export function addAnotherListButtonLabel(addButtonLabel: string): string {
  const trimmed = addButtonLabel.trim()
  if (/^\+\s*Add another\b/i.test(trimmed)) return trimmed
  if (/^\+\s*Add an\b/i.test(trimmed)) {
    return trimmed.replace(/^\+\s*Add an\b/i, "+ Add another")
  }
  if (/^\+\s*Add a\b/i.test(trimmed)) {
    return trimmed.replace(/^\+\s*Add a\b/i, "+ Add another")
  }
  if (/^\+\s*Add\b/i.test(trimmed)) {
    return trimmed.replace(/^\+\s*Add\b/i, "+ Add another")
  }
  return trimmed
}

/** Sheet / dialog title from the add-button label (without the leading "+"). */
export function listEntrySheetTitle(addButtonLabel: string, editing: boolean): string {
  const withoutPlus = addButtonLabel.trim().replace(/^\+\s*/, "")
  if (!editing) return withoutPlus || "Add"
  if (/^Add\b/i.test(withoutPlus)) {
    return withoutPlus.replace(/^Add\b/i, "Edit")
  }
  return `Edit ${withoutPlus}`
}

export function parseFormListConfig(value: unknown): FormListConfig | null {
  if (!isRecord(value)) return null
  const addButtonLabel = asTrimmedString(value.addButtonLabel)
  if (!addButtonLabel) return null

  const config: FormListConfig = { addButtonLabel }

  if (Array.isArray(value.fields)) {
    const fields = value.fields.filter(
      (key): key is PersonListFieldKey =>
        typeof key === "string" && (PERSON_LIST_FIELD_KEYS as readonly string[]).includes(key)
    )
    if (fields.length > 0) config.fields = fields
  }

  if (Array.isArray(value.relationshipChoices)) {
    const choices = value.relationshipChoices
      .map((item) => {
        if (!isRecord(item)) return null
        const label = asTrimmedString(item.label)
        const choiceVal = asTrimmedString(item.value)
        if (!label || !choiceVal) return null
        return { label, value: choiceVal }
      })
      .filter((item): item is FormListChoice => item != null)
    if (choices.length > 0) config.relationshipChoices = choices
  }

  if (Array.isArray(value.howEndedChoices)) {
    const choices = value.howEndedChoices
      .map((item) => {
        if (!isRecord(item)) return null
        const label = asTrimmedString(item.label)
        const choiceVal = asTrimmedString(item.value)
        if (!label || !choiceVal) return null
        return { label, value: choiceVal }
      })
      .filter((item): item is FormListChoice => item != null)
    if (choices.length > 0) config.howEndedChoices = choices
  }

  if (isRecord(value.labels)) {
    const labels: Partial<Record<FormListFieldLabelKey, string>> = {}
    for (const [key, label] of Object.entries(value.labels)) {
      if (!LABEL_KEYS.has(key)) continue
      if (typeof label !== "string") continue
      const trimmed = label.trim()
      if (!trimmed) continue
      labels[key as FormListFieldLabelKey] = trimmed
    }
    if (Object.keys(labels).length > 0) config.labels = labels
  }

  return config
}
