"use client"

import { useState } from "react"
import { ChevronDown, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusBadge } from "@/components/ui/status-badge"
import { getStatusConfig, type StatusConfig } from "@/lib/status"
import { cn } from "@/lib/utils"

const CONFIRMATION_STATUSES = new Set([
  "no_show",
  "cancelled",
  "discharged",
  "inactive",
])

export function StatusTransitionControl({
  status,
  statusMap,
  transitions,
  onTransition,
  disabled,
  className,
}: {
  status: string
  statusMap: Record<string, StatusConfig>
  transitions: Record<string, string[]>
  onTransition: (newStatus: string) => Promise<void>
  disabled?: boolean
  className?: string
}) {
  const [loading, setLoading] = useState(false)
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const nextStates = transitions[status] ?? []
  const isInteractive = nextStates.length > 0 && !disabled

  async function handleTransition(newStatus: string) {
    setLoading(true)
    try {
      await onTransition(newStatus)
      setConfirmStatus(null)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(newStatus: string) {
    if (CONFIRMATION_STATUSES.has(newStatus)) {
      setConfirmStatus(newStatus)
      return
    }

    void handleTransition(newStatus)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setConfirmStatus(null)
    }
  }

  if (!isInteractive) {
    return (
      <StatusBadge
        status={status}
        statusMap={statusMap}
        className={className}
      />
    )
  }

  const config = getStatusConfig(statusMap, status)
  const confirmConfig = confirmStatus
    ? getStatusConfig(statusMap, confirmStatus)
    : null

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild disabled={loading}>
        <button
          type="button"
          className={cn(
            "inline-flex rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            className
          )}
        >
          <Badge variant={config.variant} className="gap-1">
            {loading ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : null}
            {config.label}
            {!loading ? (
              <ChevronDown className="size-3" aria-hidden="true" />
            ) : null}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {confirmStatus && confirmConfig ? (
          <>
            <DropdownMenuLabel className="font-normal">
              Confirm: {confirmConfig.label}?
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start px-2 py-1.5 font-normal"
                disabled={loading}
                onClick={() => void handleTransition(confirmStatus)}
              >
                Confirm
              </Button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start px-2 py-1.5 font-normal"
                disabled={loading}
                onClick={() => setConfirmStatus(null)}
              >
                Cancel
              </Button>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel>Change status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {nextStates.map((nextStatus) => {
              const nextConfig = getStatusConfig(statusMap, nextStatus)
              return (
                <DropdownMenuItem
                  key={nextStatus}
                  disabled={loading}
                  onSelect={(event) => {
                    event.preventDefault()
                    handleSelect(nextStatus)
                  }}
                >
                  {nextConfig.label}
                </DropdownMenuItem>
              )
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
