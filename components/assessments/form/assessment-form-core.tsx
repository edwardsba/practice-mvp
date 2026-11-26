"use client"

import type { ReactNode } from "react"

import { ElementControl } from "@/components/assessments/form/element-control"
import {
  questionDisplayLabel,
  visibleElementKeys,
  type FormAnswers,
  type FormElement,
  type FormValidationError,
} from "@/lib/assessments/form-rules"
import { cn } from "@/lib/utils"

function firstVisibleGroupMember(
  elements: FormElement[],
  groupKey: string,
  visible: Set<string>
): string | null {
  const members = elements
    .filter(
      (el) => el.requiredGroupKey === groupKey && visible.has(el.elementKey)
    )
    .sort((a, b) => a.displayOrder - b.displayOrder)
  return members[0]?.elementKey ?? null
}

export function AssessmentFormCore({
  elements,
  answers,
  onAnswersChange,
  onElementActivate,
  prefilledKeys,
  errors = [],
  disabled,
  /** When set, only render elements in this group (visibility still uses all elements). */
  groupLabel,
}: {
  elements: FormElement[]
  answers: FormAnswers
  onAnswersChange: (next: FormAnswers) => void
  /** Called when the practitioner taps a control (confirms a pre-filled answer). */
  onElementActivate?: (elementKey: string) => void
  /** Element keys currently showing as pre-filled. */
  prefilledKeys?: ReadonlySet<string>
  errors?: FormValidationError[]
  disabled?: boolean
  groupLabel?: string | null
}) {
  const visible = visibleElementKeys(elements, answers)
  const errorByKey = new Map(errors.map((e) => [e.elementKey, e.message]))
  const inScope = groupLabel
    ? elements.filter((el) => el.groupLabel === groupLabel)
    : elements

  const groupFirstMember = new Map<string, string>()
  for (const element of elements) {
    if (!element.requiredGroupKey) continue
    if (groupFirstMember.has(element.requiredGroupKey)) continue
    const first = firstVisibleGroupMember(
      elements,
      element.requiredGroupKey,
      visible
    )
    if (first) groupFirstMember.set(element.requiredGroupKey, first)
  }

  function setAnswer(elementKey: string, values: string[]) {
    onElementActivate?.(elementKey)
    onAnswersChange({ ...answers, [elementKey]: values })
  }

  // Render in display order; nest children under parents visually.
  // Top-level within scope: no parent, or parent outside this group.
  const topLevel = inScope.filter((el) => {
    if (!visible.has(el.elementKey)) return false
    if (!el.parentElementKey) return true
    const parent = elements.find((p) => p.elementKey === el.parentElementKey)
    if (!parent) return true
    if (groupLabel && parent.groupLabel !== groupLabel) return true
    return false
  })

  function renderElement(element: FormElement, depth: number): ReactNode {
    if (!visible.has(element.elementKey)) return null

    const children = inScope.filter(
      (el) =>
        el.parentElementKey === element.elementKey &&
        visible.has(el.elementKey)
    )

    const isGroupFirst =
      element.requiredGroupKey &&
      groupFirstMember.get(element.requiredGroupKey) === element.elementKey

    const showRequiredMark = element.isRequired || Boolean(isGroupFirst)
    const errorMessage = errorByKey.get(element.elementKey)
    const isTick = element.elementType === "tick"

    return (
      <div
        key={element.elementKey}
        id={`question-${element.elementKey}`}
        className={cn(
          "space-y-2",
          depth > 0 && "ml-4 border-l-2 border-muted pl-4"
        )}
      >
        <div
          className={cn(
            "space-y-2 rounded-md p-1",
            errorMessage && "outline outline-2 outline-destructive/70"
          )}
        >
          {isTick ? (
            <div>
              {showRequiredMark ? (
                <p className="text-sm font-medium">
                  <span className="text-destructive" aria-hidden>
                    *
                  </span>
                </p>
              ) : null}
              {isGroupFirst ? (
                <p className="text-xs text-muted-foreground">
                  Answer at least one of these.
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <label
                id={`el-${element.elementKey}-label`}
                htmlFor={
                  element.elementType === "long_text" ||
                  element.elementType === "short_text" ||
                  element.elementType === "date"
                    ? `el-${element.elementKey}`
                    : undefined
                }
                className="text-sm font-medium"
              >
                {questionDisplayLabel(element)}
                {showRequiredMark ? (
                  <span className="ml-1 text-destructive" aria-hidden>
                    *
                  </span>
                ) : null}
                {prefilledKeys?.has(element.elementKey) ? (
                  <span className="ml-2 align-middle text-xs font-normal text-amber-800">
                    Pre-filled
                  </span>
                ) : null}
              </label>
              {isGroupFirst ? (
                <p className="text-xs text-muted-foreground">
                  Answer at least one of these.
                </p>
              ) : null}
              {element.helpText ? (
                <p className="text-xs text-muted-foreground">{element.helpText}</p>
              ) : null}
            </div>
          )}

          <ElementControl
            element={element}
            values={answers[element.elementKey] ?? []}
            onChange={(next) => setAnswer(element.elementKey, next)}
            onActivate={() => onElementActivate?.(element.elementKey)}
            error={Boolean(errorMessage)}
            disabled={disabled}
          />

          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>

        {children.map((child) => renderElement(child, depth + 1))}
      </div>
    )
  }

  // Subgroup headings: emit when subgroupLabel changes among top-level siblings.
  const nodes: ReactNode[] = []
  let lastSubgroup: string | null | undefined = undefined

  for (const element of topLevel) {
    if (element.subgroupLabel && element.subgroupLabel !== lastSubgroup) {
      nodes.push(
        <h3
          key={`subgroup-${element.elementKey}`}
          className="pt-2 text-sm font-semibold text-muted-foreground"
        >
          {element.subgroupLabel}
        </h3>
      )
      lastSubgroup = element.subgroupLabel
    } else if (!element.subgroupLabel) {
      lastSubgroup = element.subgroupLabel
    }
    nodes.push(renderElement(element, 0))
  }

  return <div className="space-y-5">{nodes}</div>
}
