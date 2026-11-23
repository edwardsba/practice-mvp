"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

type CollapsibleFundingCardProps = {
  /** "strong" = claim card (2px dark outline, shaded header); "light" = approval card. */
  variant: "strong" | "light"
  defaultOpen?: boolean
  /** Optional controlled open state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  id?: string
  className?: string
  header: ReactNode
  /** Shown in the header when the card is closed. */
  closedSummary?: ReactNode
  children: ReactNode
}

/**
 * Shared open/close card for claim cards and nested approval cards.
 * Header is tappable (min 44px), exposes aria-expanded, chevron rotates when open.
 */
export function CollapsibleFundingCard({
  variant,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  id,
  className,
  header,
  closedSummary,
  children,
}: CollapsibleFundingCardProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : uncontrolledOpen

  function setOpen(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div
      id={id}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-lg",
        variant === "strong"
          ? "border-2 border-slate-700 bg-background"
          : "ml-3 border border-border bg-background sm:ml-4",
        className
      )}
    >
      <button
        type="button"
        className={cn(
          "flex min-h-11 w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
          variant === "strong" && "bg-slate-100 dark:bg-slate-900/60",
          open && variant === "strong" && "border-b border-slate-300 dark:border-slate-700"
        )}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0 flex-1 space-y-1">
          {header}
          {!open && closedSummary ? (
            <div className="text-sm text-muted-foreground">{closedSummary}</div>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open ? <div className="px-3 py-3">{children}</div> : null}
    </div>
  )
}
