import type { FormAnswers, FormElement } from "@/lib/assessments/form-rules"
import { lrampShortDisposition } from "@/lib/assessments/lramp-summary"

/**
 * One-line session-note summary for a completed LRAMP.
 * Example: "A. Not imminently dangerous · Re-evaluate: Next individual session"
 */
export function lrampSessionSummaryLine(
  elements: FormElement[],
  answers: FormAnswers
): string | null {
  const f1Part = lrampShortDisposition(elements, answers)
  if (!f1Part) return null

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
