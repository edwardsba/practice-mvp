import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Shared shell for Emergency / Medical contact cards on Edit details.
 * Whole card is a button; hover/focus fill only (no outline change).
 */
export function TappableContactCard({
  ariaLabel,
  onClick,
  children,
  className,
}: {
  ariaLabel: string
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "w-full rounded-md border px-3 py-2 text-left text-sm",
        "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
        className
      )}
    >
      {children}
    </button>
  )
}
