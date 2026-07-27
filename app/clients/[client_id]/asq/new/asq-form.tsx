"use client"

import { useActionState } from "react"

import { saveAsqResult, type SaveAsqResultState } from "@/app/clients/[client_id]/asq/new/actions"
import { Button } from "@/components/ui/button"
import type { AsqQuestion } from "@/lib/assessments/load-asq"

const initialState: SaveAsqResultState = {}

export function AsqForm({
  clientId,
  clientName,
  questions,
  sessionNoteId,
  returnTo,
  existingResponses,
  action,
  submitLabel = "Save ASQ Result",
  warningMessage,
}: {
  clientId: string
  clientName: string
  questions: AsqQuestion[]
  sessionNoteId?: string | null
  returnTo?: string | null
  existingResponses?: Record<string, string>
  action?: (
    state: SaveAsqResultState,
    formData: FormData
  ) => Promise<SaveAsqResultState>
  submitLabel?: string
  warningMessage?: string
}) {
  const [state, formAction, pending] = useActionState(
    action ?? saveAsqResult.bind(null, clientId),
    initialState
  )

  return (
    <form action={formAction} className="space-y-8">
      {sessionNoteId ? (
        <input type="hidden" name="session_note_id" value={sessionNoteId} />
      ) : null}
      {returnTo ? (
        <input type="hidden" name="returnTo" value={returnTo} />
      ) : null}
      {warningMessage ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {warningMessage}
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Ask Suicide-Screening Questions (ASQ) for {clientName}. Answer each question
        based on the client&apos;s responses.
      </p>

      {questions.map((question, index) => (
        <fieldset key={question.elementId} className="space-y-3">
          <legend className="text-sm font-medium leading-snug">
            {index + 1}. {question.questionText}
          </legend>
          <div className="flex flex-wrap gap-6">
            {question.options.map((option) => (
              <label
                key={option.value}
                htmlFor={`${question.elementId}-${option.value}`}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  id={`${question.elementId}-${option.value}`}
                  name={`response_${question.elementId}`}
                  value={option.value}
                  defaultChecked={
                    existingResponses
                      ? existingResponses[question.elementId] === option.value
                      : undefined
                  }
                  required
                  className="size-4 accent-primary"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  )
}
