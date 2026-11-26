"use client"

import { InterviewAnswerButtons } from "@/components/client-background/interview-answer-buttons"
import { PrefilledTag } from "@/components/shared/prefilled-tag"
import type { InterviewAnswerKind, InterviewAnswerValue, InterviewItemAnswer } from "@/lib/client-background/interview-answers"

export function InterviewItemRow({
  label,
  kind,
  answer,
  /** Single-line summary (sections 1 / 2 / 4 style). */
  summary,
  /** Multi-line "Label: value" facts (section 3+) — preferred over summary when set. */
  factLines,
  disabled,
  onSelect,
  showEdit = false,
  editing = false,
  onEdit,
}: {
  label: string
  kind: InterviewAnswerKind
  answer: InterviewItemAnswer | undefined
  summary?: string | null
  factLines?: string[] | null
  disabled?: boolean
  onSelect: (value: InterviewAnswerValue) => void
  showEdit?: boolean
  editing?: boolean
  onEdit?: () => void
}) {
  const showPrefilled = Boolean(answer && !answer.confirmed)
  const lines = factLines?.length ? factLines : summary ? [summary] : null
  return (
    <div className="space-y-2 rounded-md border px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium">
          {label}
          {showPrefilled ? <PrefilledTag /> : null}
        </p>
        {showEdit && onEdit ? (
          <button
            type="button"
            className="min-h-10 text-sm font-medium text-primary underline"
            aria-pressed={editing}
            onClick={onEdit}
          >
            Edit
          </button>
        ) : null}
      </div>
      {lines ? (
        <ul className="space-y-0.5 text-sm text-muted-foreground">
          {lines.map((line) => (
            <li key={line} className="whitespace-pre-line">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      <InterviewAnswerButtons
        kind={kind}
        name={label}
        value={answer?.value ?? null}
        disabled={disabled}
        onSelect={onSelect}
      />
    </div>
  )
}
