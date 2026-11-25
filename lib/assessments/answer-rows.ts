/**
 * Pure answer-row builder for the shared results answer view — no UI.
 */

import {
  questionDisplayLabel,
  sectionLetter,
  sectionTitle,
  visibleElementKeys,
  type FormAnswers,
  type FormElement,
} from "@/lib/assessments/form-rules"
import { PRACTICE_TIMEZONE } from "@/lib/dates/practice-time"

export type AnswerDisplay =
  | { kind: "text"; value: string }
  | { kind: "list"; values: string[] }

export type AnswerRow =
  | { kind: "subheading"; label: string }
  | {
      kind: "answer"
      elementKey: string
      depth: number
      question: string
      answer: AnswerDisplay
    }

export type AnswerSection = {
  groupLabel: string
  letter: string
  title: string
  skipped: boolean
  rows: AnswerRow[]
}

function elementByKey(elements: FormElement[]): Map<string, FormElement> {
  return new Map(elements.map((el) => [el.elementKey, el]))
}

function depthOf(
  element: FormElement,
  byKey: Map<string, FormElement>
): number {
  let depth = 0
  let parentKey = element.parentElementKey
  while (parentKey) {
    depth += 1
    parentKey = byKey.get(parentKey)?.parentElementKey ?? null
  }
  return depth
}

function nonBlank(values: string[] | undefined): string[] {
  if (!values) return []
  return values.map((v) => v.trim()).filter((v) => v.length > 0)
}

function formatDateAnswer(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day, 12))
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: PRACTICE_TIMEZONE,
    })
  }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: PRACTICE_TIMEZONE,
  })
}

function displayAnswer(
  element: FormElement,
  answers: FormAnswers
): AnswerDisplay | null {
  const values = nonBlank(answers[element.elementKey])
  if (values.length === 0) return null

  switch (element.elementType) {
    case "radio":
    case "yes_no": {
      const value = values[0]
      const option = element.options.find((o) => o.value === value)
      return { kind: "text", value: option?.label ?? value }
    }
    case "checkbox": {
      const selected = new Set(values)
      const labels = element.options
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .filter((o) => selected.has(o.value))
        .map((o) => o.label)
      if (labels.length === 0) return null
      return { kind: "list", values: labels }
    }
    case "tick":
      return { kind: "text", value: "Yes" }
    case "text_list":
      return { kind: "list", values }
    case "long_text":
    case "short_text":
      return { kind: "text", value: values[0] }
    case "date":
      return { kind: "text", value: formatDateAnswer(values[0]) }
    default:
      return { kind: "text", value: values[0] }
  }
}

/**
 * Build display sections for a completed assessment instance.
 * Sections follow group_label order; rows are visible answered elements only.
 */
export function buildAnswerSections(
  elements: FormElement[],
  answers: FormAnswers
): AnswerSection[] {
  const visible = visibleElementKeys(elements, answers)
  const byKey = elementByKey(elements)

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
    const sectionElements = (byLabel.get(groupLabel) ?? [])
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)

    const visibleInSection = sectionElements.filter((el) =>
      visible.has(el.elementKey)
    )
    const skipped = visibleInSection.length === 0

    const rows: AnswerRow[] = []
    if (!skipped) {
      let lastSubgroup: string | null | undefined = undefined

      for (const element of visibleInSection) {
        const answer = displayAnswer(element, answers)
        if (!answer) continue

        const subgroup = element.subgroupLabel
        if (
          subgroup &&
          subgroup !== lastSubgroup
        ) {
          rows.push({ kind: "subheading", label: subgroup })
          lastSubgroup = subgroup
        } else if (!subgroup) {
          lastSubgroup = null
        }

        rows.push({
          kind: "answer",
          elementKey: element.elementKey,
          depth: depthOf(element, byKey),
          question: questionDisplayLabel(element),
          answer,
        })
      }
    }

    return {
      groupLabel,
      letter: sectionLetter(groupLabel),
      title: sectionTitle(groupLabel),
      skipped,
      rows,
    }
  })
}
