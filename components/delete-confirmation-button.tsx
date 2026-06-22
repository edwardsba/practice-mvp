"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DeleteConfirmationButton({
  onDelete,
  entityName,
  blockedReason,
  isLoading = false,
  dangerouslyRequireConfirmation = false,
}: {
  onDelete: () => Promise<void>
  entityName: string
  blockedReason?: string
  isLoading?: boolean
  dangerouslyRequireConfirmation?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const loading = isLoading || pending
  const isBlocked = Boolean(blockedReason)

  async function handleConfirm() {
    setError(null)
    setPending(true)

    try {
      await onDelete()
      setOpen(false)
      setConfirmText("")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete. Please try again."
      )
    } finally {
      setPending(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setConfirmText("")
      setError(null)
    }
  }

  return (
    <div className="mt-8 border-t pt-6">
      {blockedReason ? (
        <p className="mb-3 text-sm text-muted-foreground">{blockedReason}</p>
      ) : null}

      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={isBlocked || loading}
        onClick={() => setOpen(true)}
      >
        {loading ? "Deleting…" : `Delete ${entityName}`}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dangerouslyRequireConfirmation
                ? `Delete ${entityName} — Extra Confirmation Required`
                : `Delete ${entityName}?`}
            </DialogTitle>
          </DialogHeader>

          {dangerouslyRequireConfirmation ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This client has reports on file. You must type the word
                &quot;delete&quot; below to confirm you understand this action
                cannot be undone.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete_confirm_text">Type delete to confirm</Label>
                <Input
                  id="delete_confirm_text"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this {entityName.toLowerCase()}?
              This cannot be undone.
            </p>
          )}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                loading ||
                (dangerouslyRequireConfirmation && confirmText !== "delete")
              }
              onClick={handleConfirm}
            >
              {loading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
