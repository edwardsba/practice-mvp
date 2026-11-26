"use client"

import { InterviewAnswerButtons } from "@/components/client-background/interview-answer-buttons"
import { PrefilledTag } from "@/components/shared/prefilled-tag"
import type { InterviewAnswerKind, InterviewAnswerValue, InterviewItemAnswer } from "@/lib/client-background/interview-answers"

export function InterviewItemRow({
  label,
  kind,
  answer,
  summary,
  disabled,
  onSelect,
}: {
  label: string
  kind: InterviewAnswerKind
  answer: InterviewItemAnswer | undefined
  summary?: string | null
  disabled?: boolean
  onSelect: (value: InterviewAnswerValue) => void
}) {
  const showPrefilled = Boolean(answer && !answer.confirmed)
  return (
    <div className="space-y-2 rounded-md border px-3 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-sm font-medium">
          {label}
          {showPrefilled ? <PrefilledTag /> : null}
        </p>
        {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null}
      </div>
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
