"use client"

import { useActionState } from "react"

import {
  saveMseResult,
  type SaveMseResultState,
} from "@/app/clients/[client_id]/mse/new/actions"
import { CollapsibleSection } from "@/components/session-notes/collapsible-section"
import { Button } from "@/components/ui/button"
import {
  groupMseQuestions,
  type MseQuestion,
} from "@/lib/assessments/mse-grouping"

const initialState: SaveMseResultState = {}

const GROUP_DEFAULT_OPEN: Record<string, boolean> = {
  Presentation: true,
  "Mental Function": false,
  Discernment: true,
}

export function MseForm({
  clientId,
  clientName,
  questions,
  sessionNoteId,
  returnTo,
}: {
  clientId: string
  clientName: string
  questions: MseQuestion[]
  sessionNoteId?: string | null
  returnTo?: string | null
}) {
  const [state, formAction, pending] = useActionState(
    saveMseResult.bind(null, clientId),
    initialState
  )

  const groups = groupMseQuestions(questions)

  return (
    <form action={formAction} className="space-y-2">
      {sessionNoteId ? (
        <input type="hidden" name="session_note_id" value={sessionNoteId} />
      ) : null}
      {returnTo ? (
        <input type="hidden" name="returnTo" value={returnTo} />
      ) : null}
      <p className="mb-6 text-sm text-muted-foreground">
        Mental Status Examination (MSE) for {clientName}. Select one option for
        each field.
      </p>

      {groups.map((group) => (
        <CollapsibleSection
          key={group.groupLabel}
          title={group.groupLabel}
          defaultOpen={GROUP_DEFAULT_OPEN[group.groupLabel] ?? true}
        >
          <div className="space-y-6">
            {group.subgroups.map((subgroup) => (
              <div
                key={`${group.groupLabel}:${subgroup.subgroupLabel ?? "_"}`}
                className="space-y-5"
              >
                {subgroup.subgroupLabel ? (
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {subgroup.subgroupLabel}
                  </h3>
                ) : null}
                {subgroup.questions.map((question) => (
                  <fieldset key={question.elementId} className="space-y-3">
                    <legend className="text-sm font-medium leading-snug">
                      {question.questionText}
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
                            defaultChecked={option.isDefaultSelection}
                            required
                            className="size-4 accent-primary"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ))}

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save MSE"}
      </Button>
    </form>
  )
}
