import type { FormElement } from "@/lib/assessments/form-rules"

/**
 * True when the definition cannot be shown on the legacy radio-only client
 * questionnaire (any element that is not scored radio / yes_no).
 * Today that is BACKGROUND_SR; keep the check data-driven.
 */
export function definitionUsesSharedClientForm(
  elements: readonly FormElement[]
): boolean {
  if (elements.length === 0) return false
  return elements.some(
    (el) => el.elementType !== "radio" && el.elementType !== "yes_no"
  )
}
