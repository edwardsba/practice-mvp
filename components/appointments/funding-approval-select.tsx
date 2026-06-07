"use client"

import { useEffect, useState } from "react"

import { getFundingApprovalsForDropdown } from "@/lib/actions/funding"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

export function FundingApprovalSelect({
  clientId,
  defaultValue,
}: {
  clientId: string
  defaultValue?: string | null
}) {
  const [options, setOptions] = useState<
    Array<{
      fundingApprovalId: string
      label: string
      isInactive: boolean
    }>
  >([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clientId) {
      setOptions([])
      return
    }

    let cancelled = false
    setLoading(true)

    getFundingApprovalsForDropdown(clientId)
      .then((results) => {
        if (!cancelled) {
          setOptions(results)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [clientId])

  if (!clientId) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a client to choose a funding approval.
      </p>
    )
  }

  return (
    <select
      id="funding_approval_id"
      name="funding_approval_id"
      defaultValue={defaultValue ?? ""}
      disabled={loading}
      className={selectClassName}
    >
      <option value="">No funding approval (private)</option>
      {options.map((option) => (
        <option
          key={option.fundingApprovalId}
          value={option.fundingApprovalId}
          className={option.isInactive ? "text-muted-foreground" : undefined}
        >
          {option.label}
          {option.isInactive ? " (inactive)" : ""}
        </option>
      ))}
    </select>
  )
}
