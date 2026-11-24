/**
 * Pure shared assessment form rules — no database, no UI.
 *
 * Answers shape: Record<elementKey, string[]>
 * - yes_no / radio / tick / short_text / long_text / date → one value
 * - checkbox / text_list → many values
 */

export type FormElementType =
  | "radio"
  | "yes_no"
  | "checkbox"
  | "tick"
  | "text_list"
  | "long_text"
  | "short_text"
  | "date"

export type FormShowWhen = {
  key: string
  in: string[]
}

export type FormOption = {
  label: string
  value: string
  displayOrder: number
  scoreValue?: number
}

export type FormElement = {
  elementKey: string
  elementType: FormElementType
  questionText: string
  groupLabel: string | null
  subgroupLabel: string | null
  displayOrder: number
  isRequired: boolean
  parentElementKey: string | null
  showWhen: FormShowWhen | null
  requiredGroupKey: string | null
  helpText: string | null
  options: FormOption[]
}

export type FormAnswers = Record<string, string[]>

export type FormValidationError = {
  elementKey: string
  message: string
}

export type FormResponseRow = {
  elementKey: string
  responseValue: string
  responseOrder: number | null
  scoreValue: number
}

export type SectionStatusKind = "skipped" | "left" | "done"

export type SectionStatus = {
  groupLabel: string
  letter: string
  title: string
  status: SectionStatusKind
  left: number
}

export const TICK_VALUE = "ticked"

/** Letter before the first "." in a group label (e.g. "A" from "A. Reason…"). */
export function sectionLetter(groupLabel: string): string {
  const dot = groupLabel.indexOf(".")
  if (dot <= 0) return groupLabel.trim().slice(0, 1).toUpperCase() || "?"
  return groupLabel.slice(0, dot).trim()
}

/** Title after "A. " in a group label. */
export function sectionTitle(groupLabel: string): string {
  const dot = groupLabel.indexOf(".")
  if (dot < 0) return groupLabel.trim()
  return groupLabel.slice(dot + 1).trim()
}

function elementByKey(
  elements: FormElement[]
): Map<string, FormElement> {
  return new Map(elements.map((el) => [el.elementKey, el]))
}

function nonBlank(values: string[] | undefined): string[] {
  if (!values) return []
  return values.map((v) => v.trim()).filter((v) => v.length > 0)
}

function hasAnswer(element: FormElement, answers: FormAnswers): boolean {
  const values = answers[element.elementKey]
  switch (element.elementType) {
    case "checkbox":
    case "text_list":
      return nonBlank(values).length > 0
    case "tick":
      return nonBlank(values).includes(TICK_VALUE)
    case "radio":
    case "yes_no":
    case "short_text":
    case "long_text":
    case "date":
      return nonBlank(values).length > 0
    default:
      return nonBlank(values).length > 0
  }
}

function showWhenHolds(
  condition: FormShowWhen,
  answers: FormAnswers,
  visible: Set<string>
): boolean {
  if (!visible.has(condition.key)) return false
  const values = answers[condition.key] ?? []
  return values.some((v) => condition.in.includes(v))
}

/**
 * An element is visible when its parent (if any) is visible AND its show_when
 * condition holds (or is null). A hidden element's answers never count toward
 * show_when.
 */
export function visibleElementKeys(
  elements: FormElement[],
  answers: FormAnswers
): Set<string> {
  const byKey = elementByKey(elements)
  const visible = new Set<string>()
  const visiting = new Set<string>()

  function isVisible(elementKey: string): boolean {
    if (visible.has(elementKey)) return true
    if (visiting.has(elementKey)) return false

    const element = byKey.get(elementKey)
    if (!element) return false

    visiting.add(elementKey)

    if (element.parentElementKey) {
      if (!isVisible(element.parentElementKey)) {
        visiting.delete(elementKey)
        return false
      }
    }

    if (element.showWhen) {
      // Parent of the referenced key must already be evaluated via recursion
      // when we check visibility of the referenced element itself.
      if (!isVisible(element.showWhen.key)) {
        visiting.delete(elementKey)
        return false
      }
      // Temporarily treat the referenced key as visible so showWhenHolds can
      // read its answers; we already confirmed it isVisible above.
      visible.add(element.showWhen.key)
      if (!showWhenHolds(element.showWhen, answers, visible)) {
        visiting.delete(elementKey)
        return false
      }
    }

    visible.add(elementKey)
    visiting.delete(elementKey)
    return true
  }

  for (const element of elements) {
    isVisible(element.elementKey)
  }

  return visible
}

function requiredMessage(element: FormElement): string {
  return "This question is required."
}

/**
 * Validates answers against visible required fields and required groups.
 */
export function validateAnswers(
  elements: FormElement[],
  answers: FormAnswers
): FormValidationError[] {
  const visible = visibleElementKeys(elements, answers)
  const errors: FormValidationError[] = []

  for (const element of elements) {
    if (!visible.has(element.elementKey)) continue
    if (!element.isRequired) continue
    if (!hasAnswer(element, answers)) {
      errors.push({
        elementKey: element.elementKey,
        message: requiredMessage(element),
      })
    }
  }

  // Required groups: if at least one member is visible, at least one visible
  // member must have an answer. Error against the first visible member.
  const groupKeys = new Set(
    elements
      .map((el) => el.requiredGroupKey)
      .filter((k): k is string => Boolean(k))
  )

  for (const groupKey of groupKeys) {
    const members = elements.filter((el) => el.requiredGroupKey === groupKey)
    const visibleMembers = members.filter((el) => visible.has(el.elementKey))
    if (visibleMembers.length === 0) continue

    const anyAnswered = visibleMembers.some((el) => hasAnswer(el, answers))
    if (!anyAnswered) {
      const first = visibleMembers.sort(
        (a, b) => a.displayOrder - b.displayOrder
      )[0]
      errors.push({
        elementKey: first.elementKey,
        message: "Please answer at least one of these.",
      })
    }
  }

  // Option validity for radio / yes_no / checkbox
  for (const element of elements) {
    if (!visible.has(element.elementKey)) continue
    if (
      element.elementType !== "radio" &&
      element.elementType !== "yes_no" &&
      element.elementType !== "checkbox"
    ) {
      continue
    }
    const allowed = new Set(element.options.map((o) => o.value))
    const values = nonBlank(answers[element.elementKey])
    for (const value of values) {
      if (!allowed.has(value)) {
        errors.push({
          elementKey: element.elementKey,
          message: "Invalid option selected.",
        })
        break
      }
    }
  }

  return errors
}

/**
 * Drops answers for hidden elements and blank text-list entries; trims text.
 */
export function cleanAnswers(
  elements: FormElement[],
  answers: FormAnswers
): FormAnswers {
  const visible = visibleElementKeys(elements, answers)
  const byKey = elementByKey(elements)
  const cleaned: FormAnswers = {}

  for (const [key, values] of Object.entries(answers)) {
    if (!visible.has(key)) continue
    const element = byKey.get(key)
    if (!element) continue

    if (element.elementType === "text_list") {
      const trimmed = nonBlank(values)
      if (trimmed.length > 0) cleaned[key] = trimmed
      continue
    }

    if (
      element.elementType === "short_text" ||
      element.elementType === "long_text" ||
      element.elementType === "date"
    ) {
      const trimmed = nonBlank(values)
      if (trimmed.length > 0) cleaned[key] = [trimmed[0]]
      continue
    }

    if (element.elementType === "tick") {
      if (nonBlank(values).includes(TICK_VALUE)) cleaned[key] = [TICK_VALUE]
      continue
    }

    if (
      element.elementType === "radio" ||
      element.elementType === "yes_no"
    ) {
      const trimmed = nonBlank(values)
      if (trimmed.length > 0) cleaned[key] = [trimmed[0]]
      continue
    }

    if (element.elementType === "checkbox") {
      const trimmed = nonBlank(values)
      if (trimmed.length > 0) cleaned[key] = trimmed
    }
  }

  return cleaned
}

/**
 * Turns clean answers into storage rows (one row per answer).
 * Radio uses the option's scoreValue; other types score 0.
 * text_list and checkbox options get response_order 1, 2, 3, …
 */
export function toResponseRows(
  elements: FormElement[],
  answers: FormAnswers
): FormResponseRow[] {
  const cleaned = cleanAnswers(elements, answers)
  const byKey = elementByKey(elements)
  const rows: FormResponseRow[] = []

  const orderedKeys = elements
    .filter((el) => cleaned[el.elementKey] !== undefined)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((el) => el.elementKey)

  for (const key of orderedKeys) {
    const element = byKey.get(key)
    if (!element) continue
    const values = cleaned[key] ?? []

    if (element.elementType === "text_list") {
      values.forEach((value, index) => {
        rows.push({
          elementKey: key,
          responseValue: value,
          responseOrder: index + 1,
          scoreValue: 0,
        })
      })
      continue
    }

    if (element.elementType === "checkbox") {
      values.forEach((value, index) => {
        rows.push({
          elementKey: key,
          responseValue: value,
          responseOrder: index + 1,
          scoreValue: 0,
        })
      })
      continue
    }

    if (element.elementType === "radio") {
      const value = values[0]
      if (!value) continue
      const option = element.options.find((o) => o.value === value)
      rows.push({
        elementKey: key,
        responseValue: value,
        responseOrder: null,
        scoreValue: option?.scoreValue ?? 0,
      })
      continue
    }

    // yes_no, tick, short_text, long_text, date
    const value = values[0]
    if (!value) continue
    rows.push({
      elementKey: key,
      responseValue: value,
      responseOrder: null,
      scoreValue: 0,
    })
  }

  return rows
}

/**
 * Sections are distinct non-null group_label values, in first-seen display order.
 * - skipped: no element in the section is visible
 * - left: visible required elements still unanswered; each unanswered
 *   "at least one" group counts once
 * - done: visible and nothing left
 */
export function sectionStatuses(
  elements: FormElement[],
  answers: FormAnswers
): SectionStatus[] {
  const visible = visibleElementKeys(elements, answers)
  const orderedLabels: string[] = []
  const byLabel = new Map<string, FormElement[]>()

  for (const element of elements) {
    const label = element.groupLabel
    if (!label) continue
    if (!byLabel.has(label)) {
      byLabel.set(label, [])
      orderedLabels.push(label)
    }
    byLabel.get(label)!.push(element)
  }

  return orderedLabels.map((groupLabel) => {
    const sectionElements = byLabel.get(groupLabel) ?? []
    const visibleInSection = sectionElements.filter((el) =>
      visible.has(el.elementKey)
    )

    if (visibleInSection.length === 0) {
      return {
        groupLabel,
        letter: sectionLetter(groupLabel),
        title: sectionTitle(groupLabel),
        status: "skipped" as const,
        left: 0,
      }
    }

    let left = 0
    const countedGroups = new Set<string>()

    for (const element of visibleInSection) {
      if (element.requiredGroupKey) {
        if (countedGroups.has(element.requiredGroupKey)) continue
        countedGroups.add(element.requiredGroupKey)
        const groupMembers = visibleInSection.filter(
          (el) => el.requiredGroupKey === element.requiredGroupKey
        )
        if (!groupMembers.some((el) => hasAnswer(el, answers))) {
          left += 1
        }
        continue
      }

      if (element.isRequired && !hasAnswer(element, answers)) {
        left += 1
      }
    }

    if (left > 0) {
      return {
        groupLabel,
        letter: sectionLetter(groupLabel),
        title: sectionTitle(groupLabel),
        status: "left" as const,
        left,
      }
    }

    return {
      groupLabel,
      letter: sectionLetter(groupLabel),
      title: sectionTitle(groupLabel),
      status: "done" as const,
      left: 0,
    }
  })
}

/**
 * Turns saved response rows back into FormAnswers, ordered by response_order.
 */
export function answersFromResponseRows(
  rows: Array<{
    elementKey: string
    responseValue: string
    responseOrder: number | null
  }>
): FormAnswers {
  const sorted = [...rows].sort((a, b) => {
    if (a.elementKey !== b.elementKey) {
      return a.elementKey.localeCompare(b.elementKey)
    }
    const ao = a.responseOrder ?? 0
    const bo = b.responseOrder ?? 0
    return ao - bo
  })

  const answers: FormAnswers = {}
  for (const row of sorted) {
    const list = answers[row.elementKey] ?? []
    list.push(row.responseValue)
    answers[row.elementKey] = list
  }
  return answers
}

/**
 * Short label from an element key when it has a clear section number
 * (e.g. lramp_a1 → "A1", lramp_e11_1 → "E11.1"). Otherwise null.
 */
export function elementShortLabel(elementKey: string): string | null {
  const stripped = elementKey.replace(/^[a-z]+_/i, "")
  const match = /^([a-z])(\d+)(?:_(\d+))?$/i.exec(stripped)
  if (!match) return null
  const letter = match[1].toUpperCase()
  const major = String(Number(match[2]))
  if (match[3]) {
    return `${letter}${major}.${Number(match[3])}`
  }
  return `${letter}${major}`
}

export function questionDisplayLabel(element: FormElement): string {
  const short = elementShortLabel(element.elementKey)
  if (short) return `${short}. ${element.questionText}`
  return element.questionText
}
