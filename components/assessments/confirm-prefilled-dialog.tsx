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
 * In-page confirm dialog for unconfirmed pre-filled assessment answers
 * (not window.confirm).
 */
export function ConfirmPrefilledDialog({
  open,
  title,
  body,
  onGoBack,
  onConfirmAndSave,
}: {
  open: boolean
  title: string
  body: string
  onGoBack: () => void
  onConfirmAndSave: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onGoBack()
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm"
            onClick={onGoBack}
          >
            Go back
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground"
            onClick={onConfirmAndSave}
          >
            Confirm and save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
