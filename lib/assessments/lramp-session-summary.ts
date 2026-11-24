import type { FormAnswers, FormElement } from "@/lib/assessments/form-rules"

/**
 * One-line session-note summary for a completed LRAMP.
 * Example: "A. Not imminently dangerous · Re-evaluate: Next individual session"
 *
 * F1: option letter + first clause of the label (text before the first ";" or
 * truncated at a natural break — use text before the first "," when the label
 * is long, else the full short label; for LRAMP F1 options the "first clause"
 * is the stretch up to the first " and " or we take a shortened form).
 *
 * Spec: "F1's option letter and the label's first clause, then ' · Re-evaluate: '
 * and F2's ticked labels joined with ', '"
 * Example: "A. Not imminently dangerous · Re-evaluate: Next individual session"
 */
export function lrampSessionSummaryLine(
  elements: FormElement[],
  answers: FormAnswers
): string | null {
  const f1 = answers.lramp_f1?.[0]
  if (!f1) return null

  const f1Element = elements.find((el) => el.elementKey === "lramp_f1")
  const option = f1Element?.options.find((o) => o.value === f1)
  if (!option) return null

  const letter = f1.toUpperCase()
  const firstClause = firstClauseOfLabel(option.label)
  const f1Part = `${letter}. ${firstClause}`

  const f2Element = elements.find((el) => el.elementKey === "lramp_f2")
  const f2Values = answers.lramp_f2 ?? []
  const f2Labels = f2Values
    .map(
      (value) => f2Element?.options.find((o) => o.value === value)?.label ?? null
    )
    .filter((label): label is string => Boolean(label))

  const f2Other = (answers.lramp_f2_other ?? []).filter((v) => v.trim())
  const reEvalParts = [...f2Labels, ...f2Other]
  if (reEvalParts.length === 0) {
    return f1Part
  }

  return `${f1Part} · Re-evaluate: ${reEvalParts.join(", ")}`
}

function firstClauseOfLabel(label: string): string {
  // Match the example: option `a` → "Not imminently dangerous"
  // Full label: "The client is not imminently dangerous to self and will be…"
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

  // Generic: text up to first ";" or first ", " after 20+ chars, else full.
  const semi = label.indexOf(";")
  if (semi > 0) return label.slice(0, semi).trim()
  const comma = label.indexOf(", ")
  if (comma > 20) return label.slice(0, comma).trim()
  return label.trim()
}
