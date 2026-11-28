"use client"

import { InterviewAnswerButtons } from "@/components/client-background/interview-answer-buttons"
import { PrefilledTag } from "@/components/shared/prefilled-tag"
import {
  isQuestionKind,
  type InterviewAnswerValue,
  type InterviewItemAnswer,
  type InterviewItemDef,
} from "@/lib/client-background/interview-answers"
import { statusColours } from "@/lib/ui/status-colours"
import { cn } from "@/lib/utils"

/** Whether a tree heading has anything of its interview item to show. */
export function headingAnswerHasContent(
  item: InterviewItemDef,
  answer: InterviewItemAnswer | undefined,
  contradictionNote: string | null
): boolean {
  return isQuestionKind(item.kind) || Boolean(answer && !answer.confirmed) || Boolean(contradictionNote)
}

/**
 * Background interview answer under a tree heading (sections 5, 6, 8, 9).
 * Questions show their answer buttons; details items (Biological parents) only show
 * Pre-filled — Confirm section signs them off.
 */
export function InterviewHeadingAnswer({
  item,
  answer,
  contradictionNote,
  onSelect,
}: {
  item: InterviewItemDef
  answer: InterviewItemAnswer | undefined
  contradictionNote: string | null
  onSelect: (value: InterviewAnswerValue) => void
}) {
  const prefilled = Boolean(answer && !answer.confirmed)
  return (
    <div id={`check-contradiction-${item.key}`} className="scroll-mt-36 space-y-1.5">
      {isQuestionKind(item.kind) ? (
        <div className="flex flex-wrap items-center gap-y-1">
          <InterviewAnswerButtons
            kind={item.kind}
            name={item.label}
            value={answer?.value ?? null}
            onSelect={onSelect}
          />
          {prefilled ? <PrefilledTag /> : null}
        </div>
      ) : prefilled ? (
        <p className="text-xs text-muted-foreground">
          Carried over from the last interview
          <PrefilledTag />
        </p>
      ) : null}
      {contradictionNote ? (
        <p className={cn("px-2 py-1.5 text-sm", statusColours.attention.soft)}>{contradictionNote}</p>
      ) : null}
    </div>
  )
}
