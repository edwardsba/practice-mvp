"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * In-page "Discard changes?" dialog (not window.confirm).
 * Shared by Client Background and the Interview relationships UI.
 */
export function DiscardChangesDialog({
  open,
  onDiscard,
  onKeepEditing,
}: {
  open: boolean
  onDiscard: () => void
  onKeepEditing: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onKeepEditing()
      }}
    >
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Discard changes?</DialogTitle>
          <DialogDescription>
            You have unsaved changes. Discard them, or keep editing.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm"
            onClick={onKeepEditing}
          >
            Keep editing
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-md bg-destructive px-3 text-sm text-destructive-foreground"
            onClick={onDiscard}
          >
            Discard
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
