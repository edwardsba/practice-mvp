"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Shared right-hand side panel for relationship and history trees.
 * See AGENTS.md — "Trees and panels: one look."
 *
 * Two modes:
 * - Info page: pass `leading` (avatar/tag) + `summary`; body is read-only fields; footer Edit.
 * - Form: title only (or context strip for new items); one field per line; footer Remove · Cancel · Save.
 */
export function SidePanel({
  title,
  summary,
  leading,
  ariaLabel,
  onDismiss,
  context,
  children,
  footer,
  returnFocusRef,
}: {
  title: string
  /** One summary line under the title (info page). */
  summary?: string
  /** Avatar (people), tag (events), or nothing (relationships, issues). */
  leading?: ReactNode
  ariaLabel?: string
  onDismiss: () => void
  /** Optional grey context strip (e.g. “Adding to: …”). */
  context?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Element that opened the panel — focus returns here on close. */
  returnFocusRef?: React.RefObject<HTMLElement | null>
}) {
  const panelRef = useRef<HTMLElement>(null)
  const titleId = useId()
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const returnTo = returnFocusRef?.current ?? null
    if (!panel) return

    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1)

    const first = focusables()[0]
    ;(first ?? panel).focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation()
        onDismiss()
        return
      }
      if (event.key !== "Tab" || !panelRef.current) return
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }
      const firstItem = items[0]!
      const lastItem = items[items.length - 1]!
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown, true)
    return () => {
      window.removeEventListener("keydown", onKeyDown, true)
      const restore = returnTo ?? previousFocus.current
      restore?.focus?.()
    }
  }, [onDismiss, returnFocusRef])

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/20" aria-label="Dismiss" onClick={onDismiss} />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={ariaLabel ?? title}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full animate-[side-panel-in_200ms_ease-out] flex-col bg-background shadow-xl outline-none sm:w-[440px]"
      >
        <style>{`@keyframes side-panel-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        <header className="flex items-start gap-3 border-b px-4 py-4">
          {leading ? <div className="mt-0.5 shrink-0">{leading}</div> : null}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold leading-snug break-words">
              {title}
            </h2>
            {summary ? <p className="mt-0.5 text-sm text-muted-foreground break-words">{summary}</p> : null}
          </div>
          <button
            type="button"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-muted"
            aria-label="Close"
            onClick={onDismiss}
          >
            <X className="size-4" />
          </button>
        </header>
        {context ? <div className="border-b bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{context}</div> : null}
        <div
          className={cn(
            "min-h-0 flex-1 flex flex-col",
            footer != null ? "overflow-y-auto p-4" : "overflow-hidden"
          )}
        >
          {children}
        </div>
        {footer ? <div className="border-t">{footer}</div> : null}
      </aside>
    </div>
  )
}

/**
 * Form footer: Remove (left, existing only) · Cancel · Save.
 * Fixed at the bottom of the panel.
 */
export function SidePanelFooter({
  saving = false,
  saveDisabled = false,
  saveLabel = "Save",
  onRemove,
  onCancel,
  onSave,
  className,
}: {
  saving?: boolean
  saveDisabled?: boolean
  saveLabel?: string
  onRemove?: () => void
  onCancel: () => void
  onSave: () => void
  className?: string
}) {
  return (
    <footer className={cn("flex flex-wrap items-center gap-2 p-4", className)}>
      {onRemove ? (
        <button
          type="button"
          className="inline-flex min-h-10 items-center text-sm text-destructive underline-offset-2 hover:underline"
          disabled={saving}
          onClick={onRemove}
        >
          Remove
        </button>
      ) : null}
      <span className="flex-1" />
      <button
        type="button"
        className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm"
        disabled={saving}
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
        disabled={saving || saveDisabled}
        onClick={onSave}
      >
        {saveLabel}
      </button>
    </footer>
  )
}
