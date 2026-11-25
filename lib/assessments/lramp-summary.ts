/**
 * LRAMP result summary (results page) and short disposition helper
 * shared with the session-note one-liner.
 */

import type { FormAnswers, FormElement } from "@/lib/assessments/form-rules"

export type ResultSummaryLine = {
  label: string
  /** Full text after an optional bold lead (e.g. disposition label). */
  value: string
  /** Bold prefix such as "B." for Final disposition. */
  lead?: string
}

function firstClauseOfLabel(label: string): string {
  const lower = label.toLowerCase()
  if (lower.includes("not imminently dangerous")) {
    return "Not imminently dangerous"
  }
  if (lower.includes("some imminent danger")) {
    return "Some imminent danger"
  }
  if (lower.includes("emergency intervention is needed")) {
    return "Emergency intervention needed"
  }
  if (lower.includes("significant uncertainty")) {
    return "Significant uncertainty"
  }

  const semi = label.indexOf(";")
  if (semi > 0) return label.slice(0, semi).trim()
  const comma = label.indexOf(", ")
  if (comma > 20) return label.slice(0, comma).trim()
  return label.trim()
}

/**
 * Short disposition for Score column / session-note line, e.g.
 * "B. Some imminent danger".
 */
export function lrampShortDisposition(
  elements: FormElement[],
  answers: FormAnswers
): string | null {
  const f1 = answers.lramp_f1?.[0]
  if (!f1) return null

  const f1Element = elements.find((el) => el.elementKey === "lramp_f1")
  const option = f1Element?.options.find((o) => o.value === f1)
  if (!option) return null

  return `${f1.toUpperCase()}. ${firstClauseOfLabel(option.label)}`
}

function reEvaluateText(
  elements: FormElement[],
  answers: FormAnswers
): string {
  const f2Element = elements.find((el) => el.elementKey === "lramp_f2")
  const f2Values = new Set(answers.lramp_f2 ?? [])
  const f2Labels = (f2Element?.options ?? [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .filter((o) => f2Values.has(o.value))
    .map((o) => o.label)

  const f2Other = (answers.lramp_f2_other ?? []).filter((v) => v.trim())
  return [...f2Labels, ...f2Other].join(", ")
}

function countRiskAnswers(
  answers: FormAnswers,
  prefix: "lramp_c" | "lramp_d",
  count: number
): { yes: number; somewhat: number } {
  let yes = 0
  let somewhat = 0
  for (let i = 1; i <= count; i++) {
    const key = `${prefix}${String(i).padStart(2, "0")}`
    const value = answers[key]?.[0]
    if (value === "yes") yes += 1
    else if (value === "somewhat") somewhat += 1
  }
  return { yes, somewhat }
}

function formatFactorCounts(yes: number, somewhat: number): string {
  if (yes === 0 && somewhat === 0) return "None"
  const parts: string[] = []
  if (yes > 0) parts.push(`${yes} Yes`)
  if (somewhat > 0) parts.push(`${somewhat} Somewhat`)
  return parts.join(" · ")
}

/**
 * Summary box rows for an LRAMP result.
 */
export function lrampResultSummary(
  answers: FormAnswers,
  elements: FormElement[]
): ResultSummaryLine[] {
  const f1 = answers.lramp_f1?.[0]
  const f1Element = elements.find((el) => el.elementKey === "lramp_f1")
  const f1Option = f1
    ? f1Element?.options.find((o) => o.value === f1)
    : undefined

  const b1 = answers.lramp_b1?.[0]
  const formal =
    b1 === "yes" ? "Conducted" : b1 === "no" ? "Not conducted" : "—"

  let riskText = "—"
  let protectiveText = "—"
  if (b1 === "no") {
    riskText = "Not asked"
    protectiveText = "Not asked"
  } else if (b1 === "yes") {
    const risk = countRiskAnswers(answers, "lramp_c", 19)
    const protective = countRiskAnswers(answers, "lramp_d", 11)
    riskText = formatFactorCounts(risk.yes, risk.somewhat)
    protectiveText = formatFactorCounts(protective.yes, protective.somewhat)
  }

  const rows: ResultSummaryLine[] = [
    {
      label: "Final disposition",
      lead: f1 ? `${f1.toUpperCase()}.` : undefined,
      value: f1Option?.label ?? "—",
    },
    {
      label: "Re-evaluate",
      value: reEvaluateText(elements, answers) || "—",
    },
    {
      label: "Formal assessment",
      value: formal,
    },
    {
      label: "Risk factors",
      value: riskText,
    },
    {
      label: "Protective factors",
      value: protectiveText,
    },
  ]

  return rows
}
