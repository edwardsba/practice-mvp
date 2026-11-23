"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect } from "react"

import {
  createEmergencyContact,
  deleteEmergencyContact,
  updateEmergencyContact,
  type EmergencyContactFormState,
} from "@/app/clients/[client_id]/emergency-contacts/actions"
import { DeleteConfirmationButton } from "@/components/delete-confirmation-button"
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
import type { EmergencyContactRow } from "@/lib/crisis-plans/types"

export function EmergencyContactDialog({
  open,
  onOpenChange,
  clientId,
  contact,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  contact?: EmergencyContactRow | null
}) {
  const router = useRouter()
  const action = contact
    ? updateEmergencyContact.bind(null, clientId, contact.contactId)
    : createEmergencyContact.bind(null, clientId)

  const [state, formAction, pending] = useActionState(
    action,
    {} as EmergencyContactFormState
  )

  useEffect(() => {
    if (state.success) {
      onOpenChange(false)
    }
  }, [state.success, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {contact ? "Edit emergency contact" : "Add emergency contact"}
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              name="role"
              defaultValue={contact?.role ?? ""}
              placeholder="e.g. Partner"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={contact?.name ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={contact?.phone ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={contact?.email ?? ""}
            />
          </div>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-end sm:justify-between">
            {contact ? (
              <div className="[&>div]:mt-0 [&>div]:border-0 [&>div]:pt-0">
                <DeleteConfirmationButton
                  entityName="emergency contact"
                  onDelete={async () => {
                    const result = await deleteEmergencyContact(
                      clientId,
                      contact.contactId
                    )
                    if (result.error) throw new Error(result.error)
                    onOpenChange(false)
                    router.refresh()
                  }}
                />
              </div>
            ) : (
              <span />
            )}
            <DialogFooter className="sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
