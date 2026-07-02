"use client"

import { useActionState, useEffect, useState } from "react"

import { upsertClaimType, type FundingFormState } from "@/lib/actions/funding"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function ClaimTypesManager({
  practiceId,
  claimTypes,
}: {
  practiceId: string
  claimTypes: Array<{ claimTypeId: string; claimTypeName: string }>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <AddClaimTypeForm practiceId={practiceId} />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Claim type name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claimTypes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={1}
                  className="h-20 text-center text-muted-foreground"
                >
                  No claim types yet.
                </TableCell>
              </TableRow>
            ) : (
              claimTypes.map((claimType) => {
                const isEditing = editingId === claimType.claimTypeId

                return (
                  <TableRow
                    key={claimType.claimTypeId}
                    className={
                      isEditing ? undefined : "cursor-pointer hover:bg-muted/50"
                    }
                    onClick={
                      isEditing
                        ? undefined
                        : () => setEditingId(claimType.claimTypeId)
                    }
                  >
                    <TableCell>
                      {isEditing ? (
                        <EditClaimTypeForm
                          practiceId={practiceId}
                          claimTypeId={claimType.claimTypeId}
                          defaultName={claimType.claimTypeName}
                          onDone={() => setEditingId(null)}
                        />
                      ) : (
                        claimType.claimTypeName
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function AddClaimTypeForm({ practiceId }: { practiceId: string }) {
  const [state, formAction, pending] = useActionState(
    upsertClaimType.bind(null, practiceId, undefined) as (
      prevState: FundingFormState,
      formData: FormData
    ) => Promise<FundingFormState>,
    {} as FundingFormState
  )

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1 space-y-2">
        <label htmlFor="new_claim_type_name" className="text-sm font-medium">
          Claim type name
        </label>
        <Input
          id="new_claim_type_name"
          name="claim_type_name"
          required
          placeholder="e.g. Medicare"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add claim type"}
      </Button>
      {state.error ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

function EditClaimTypeForm({
  practiceId,
  claimTypeId,
  defaultName,
  onDone,
}: {
  practiceId: string
  claimTypeId: string
  defaultName: string
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState(
    upsertClaimType.bind(null, practiceId, claimTypeId) as (
      prevState: FundingFormState,
      formData: FormData
    ) => Promise<FundingFormState>,
    {} as FundingFormState
  )

  useEffect(() => {
    if (state.success) {
      onDone()
    }
  }, [state.success, onDone])

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Input
        name="claim_type_name"
        defaultValue={defaultName}
        required
        className="max-w-xs"
      />
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onDone}>
        Cancel
      </Button>
    </form>
  )
}
