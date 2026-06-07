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
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {claimTypes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="h-20 text-center text-muted-foreground"
                >
                  No claim types yet.
                </TableCell>
              </TableRow>
            ) : (
              claimTypes.map((claimType) => (
                <TableRow key={claimType.claimTypeId}>
                  <TableCell>
                    {editingId === claimType.claimTypeId ? (
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
                  <TableCell>
                    {editingId === claimType.claimTypeId ? null : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(claimType.claimTypeId)}
                      >
                        Edit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
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
