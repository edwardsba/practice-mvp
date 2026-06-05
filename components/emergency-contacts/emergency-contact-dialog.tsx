"use client"

import { useActionState, useEffect } from "react"

import {
  createEmergencyContact,
  updateEmergencyContact,
  type EmergencyContactFormState,
} from "@/app/clients/[client_id]/emergency-contacts/actions"
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

          <DialogFooter>
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
        </form>
      </DialogContent>
    </Dialog>
  )
}
