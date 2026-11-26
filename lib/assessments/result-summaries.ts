/**
 * Tiny registry: assessment code → result summary builder.
 * Shared-form assessments with no entry simply show no summary box.
 */

import {
  asqResultSummary,
  type AsqResultSummaryExtras,
} from "@/lib/assessments/asq-summary"
import {
  lrampResultSummary,
  type ResultSummaryLine,
} from "@/lib/assessments/lramp-summary"
import { mseResultSummary } from "@/lib/assessments/mse-summary"
import type { FormAnswers, FormElement } from "@/lib/assessments/form-rules"

export type { ResultSummaryLine }

/** Optional stored-result fields some builders (ASQ) read. */
export type ResultSummaryExtras = AsqResultSummaryExtras

export type ResultSummaryBuilder = (
  answers: FormAnswers,
  elements: FormElement[],
  extras?: ResultSummaryExtras
) => ResultSummaryLine[]

const REGISTRY: Record<string, ResultSummaryBuilder> = {
  LRAMP: lrampResultSummary,
  ASQ: asqResultSummary,
  mse: mseResultSummary,
}

export function getResultSummaryBuilder(
  assessmentCode: string
): ResultSummaryBuilder | null {
  return REGISTRY[assessmentCode] ?? null
}
