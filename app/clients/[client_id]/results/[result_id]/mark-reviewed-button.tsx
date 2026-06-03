"use client"

import { useActionState } from "react"

import {
  markResultAsReviewed,
  type MarkReviewedState,
} from "@/app/clients/[client_id]/results/[result_id]/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const initialState: MarkReviewedState = {}

export function MarkReviewedButton({
  clientId,
  resultId,
  status,
}: {
  clientId: string
  resultId: string
  status: string
}) {
  const [state, formAction, pending] = useActionState(
    markResultAsReviewed.bind(null, clientId, resultId),
    initialState
  )

  const isReviewed = status === "reviewed" || state.success

  if (isReviewed) {
    return <Badge variant="success">Reviewed</Badge>
  }

  return (
    <form action={formAction}>
      {state.error ? (
        <p className="mb-2 text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Mark as Reviewed"}
      </Button>
    </form>
  )
}
