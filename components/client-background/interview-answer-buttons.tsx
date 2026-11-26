"use client"

import { optionsForKind, type InterviewAnswerKind, type InterviewAnswerValue } from "@/lib/client-background/interview-answers"
import { cn } from "@/lib/utils"

export function InterviewAnswerButtons({
  kind,
  value,
  disabled,
  onSelect,
  name,
}: {
  kind: InterviewAnswerKind
  value: InterviewAnswerValue | null
  disabled?: boolean
  onSelect: (value: InterviewAnswerValue) => void
  name: string
}) {
  const options = optionsForKind(kind)
  return (
    <div role="radiogroup" aria-label={name} className="inline-flex flex-wrap gap-1 rounded-md border p-0.5">
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={cn(
              "min-h-10 rounded px-2.5 text-sm",
              selected ? "bg-neutral-900 text-white" : "bg-background text-foreground hover:bg-muted"
            )}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
