"use client"

import { useId } from "react"

import { Button } from "@/components/ui/button"
import { answerQuestionsFirstLabel } from "@/lib/client-background/interview-answers"

/**
 * Foot of a Background interview section: Nothing to record (where the section has it
 * and questions are unanswered), then Confirm section. Confirm stays disabled until every
 * question in the section is answered.
 */
export function InterviewConfirmSection({
  unansweredQuestions,
  showNothingToRecord,
  confirming = false,
  error,
  onNothingToRecord,
  onConfirm,
}: {
  unansweredQuestions: number
  showNothingToRecord: boolean
  confirming?: boolean
  error?: string | null
  onNothingToRecord: () => void
  onConfirm: () => void
}) {
  const helperId = useId()
  const blocked = unansweredQuestions > 0
  return (
    <div className="space-y-2 border-t pt-4">
      {showNothingToRecord && blocked ? (
        <button
          type="button"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-dashed px-3 text-sm"
          disabled={confirming}
          onClick={onNothingToRecord}
        >
          Nothing to record
        </button>
      ) : null}
      <Button
        type="button"
        className="min-h-11 w-full"
        disabled={blocked || confirming}
        aria-describedby={blocked ? helperId : undefined}
        onClick={onConfirm}
      >
        {confirming ? "Confirming…" : "Confirm section"}
      </Button>
      {blocked ? (
        <p id={helperId} className="text-center text-sm text-muted-foreground">
          {answerQuestionsFirstLabel(unansweredQuestions)}
        </p>
      ) : null}
      {error ? (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
