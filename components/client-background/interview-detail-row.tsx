"use client"

import { PrefilledTag } from "@/components/shared/prefilled-tag"
import type { InterviewItemAnswer } from "@/lib/client-background/interview-answers"
import { statusColours } from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

const NOT_RECORDED = "Not recorded"

/**
 * A details item in the Background interview (sections 1–4 and 7): what is on file, with Edit.
 * No answer buttons — Confirm section signs details off.
 */
export function InterviewDetailRow({
  label,
  answer,
  factLines,
  contradictionNote,
  onEdit,
}: {
  label: string
  answer: InterviewItemAnswer | undefined
  factLines: readonly string[] | null
  /** Attention note when the answer contradicts records on file. */
  contradictionNote?: string | null
  onEdit?: () => void
}) {
  const lines = (factLines ?? []).filter((line) => line.trim())
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs text-muted-foreground">
          {label}
          {answer && !answer.confirmed ? <PrefilledTag /> : null}
        </p>
        {lines.length > 0 ? (
          <ul className="space-y-0.5 text-sm text-foreground">
            {lines.map((line, index) => (
              <li key={`${index}-${line}`} className="whitespace-pre-line break-words">
                <FactLine line={line} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-muted-foreground">{NOT_RECORDED}</p>
        )}
        {contradictionNote ? (
          <p className={cn("mt-1.5 px-2 py-1.5 text-sm", statusColours.attention.soft)}>{contradictionNote}</p>
        ) : null}
      </div>
      {onEdit ? (
        <button
          type="button"
          className="min-h-10 shrink-0 text-sm font-medium text-primary underline"
          aria-label={`Edit ${label}`}
          onClick={onEdit}
        >
          Edit
        </button>
      ) : null}
    </div>
  )
}

/** "Not recorded" (alone or after "Label: ") reads as missing, not as a fact. */
function FactLine({ line }: { line: string }) {
  const trimmed = line.trim()
  if (trimmed === NOT_RECORDED) {
    return <span className="italic text-muted-foreground">{NOT_RECORDED}</span>
  }
  if (trimmed.endsWith(`: ${NOT_RECORDED}`)) {
    return (
      <>
        {trimmed.slice(0, -NOT_RECORDED.length)}
        <span className="italic text-muted-foreground">{NOT_RECORDED}</span>
      </>
    )
  }
  return <>{line}</>
}
