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

const TICK_VALUE = "ticked"

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
