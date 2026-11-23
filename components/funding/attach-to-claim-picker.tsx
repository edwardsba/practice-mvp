"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  attachFundingApprovalToClaim,
  type FundingFormState,
} from "@/lib/actions/funding"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type AttachClaimOption = {
  claimId: string
  claimTypeName: string
  isActive: boolean
}

const initialState: FundingFormState = {}

/**
 * In-page picker to attach a referral/approval with no claim to one of the
 * client's claims. Nothing is saved until Save; Cancel leaves it unchanged.
 */
export function AttachToClaimPicker({
  clientId,
  fundingApprovalId,
  claims,
  returnPath,
  onCancel,
}: {
  clientId: string
  fundingApprovalId: string
  claims: AttachClaimOption[]
  returnPath: string
  onCancel: () => void
}) {
  const router = useRouter()
  const [selectedClaimId, setSelectedClaimId] = useState<string>("")
  const [state, formAction, pending] = useActionState(
    attachFundingApprovalToClaim,
    initialState
  )

  useEffect(() => {
    if (state.success) {
      router.refresh()
      onCancel()
    }
  }, [state.success, onCancel, router])

  const ordered = [
    ...claims.filter((row) => row.isActive),
    ...claims.filter((row) => !row.isActive),
  ]

  if (ordered.length === 0) {
    return (
      <div className="space-y-3 rounded-md border border-dashed p-3 text-sm">
        <p className="text-muted-foreground">
          This client has no claims yet.
        </p>
        <Link
          href={`/funding/claims/new?client_id=${clientId}&returnTo=${encodeURIComponent(returnPath)}`}
          className="font-medium text-primary hover:underline"
        >
          + New claim
        </Link>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-3 rounded-md border p-3">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="funding_approval_id" value={fundingApprovalId} />
      <input type="hidden" name="claim_id" value={selectedClaimId} />
      <p className="text-sm font-medium">Attach to a claim</p>
      <ul className="space-y-1">
        {ordered.map((claim) => {
          const selected = selectedClaimId === claim.claimId
          return (
            <li key={claim.claimId}>
              <button
                type="button"
                className={cn(
                  "flex min-h-11 w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm",
                  selected
                    ? "border-slate-700 bg-slate-50 dark:bg-slate-900/40"
                    : "hover:bg-muted/40"
                )}
                onClick={() => setSelectedClaimId(claim.claimId)}
              >
                <span>
                  {claim.claimTypeName} · {claim.isActive ? "Active" : "Inactive"}
                </span>
                {selected ? (
                  <span className="text-xs text-muted-foreground">Selected</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!selectedClaimId || pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  )
}
