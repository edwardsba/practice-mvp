/**
 * Tiny registry: assessment code → result summary builder.
 * Shared-form assessments with no entry simply show no summary box.
 */

import {
  lrampResultSummary,
  type ResultSummaryLine,
} from "@/lib/assessments/lramp-summary"
import type { FormAnswers, FormElement } from "@/lib/assessments/form-rules"

export type { ResultSummaryLine }

export type ResultSummaryBuilder = (
  answers: FormAnswers,
  elements: FormElement[]
) => ResultSummaryLine[]

const REGISTRY: Record<string, ResultSummaryBuilder> = {
  LRAMP: lrampResultSummary,
}

export function getResultSummaryBuilder(
  assessmentCode: string
): ResultSummaryBuilder | null {
  return REGISTRY[assessmentCode] ?? null
}
