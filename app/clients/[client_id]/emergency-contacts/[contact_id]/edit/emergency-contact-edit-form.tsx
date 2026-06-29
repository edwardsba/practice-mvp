"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useEffect } from "react"

import {
  deleteEmergencyContact,
  updateEmergencyContact,
  type EmergencyContactFormState,
} from "@/app/clients/[client_id]/emergency-contacts/actions"
import { DeleteConfirmationButton } from "@/components/delete-confirmation-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { EmergencyContactRow } from "@/lib/crisis-plans/types"

export function EmergencyContactEditForm({
  clientId,
  contact,
}: {
  clientId: string
  contact: EmergencyContactRow
}) {
  const router = useRouter()
  const action = updateEmergencyContact.bind(null, clientId, contact.contactId)
  const [state, formAction, pending] = useActionState(
    action,
    {} as EmergencyContactFormState
  )

  useEffect(() => {
    if (state.success) {
      router.push(`/clients/${clientId}`)
    }
  }, [state.success, clientId, router])

  return (
    <>
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            name="role"
            defaultValue={contact.role ?? ""}
            placeholder="e.g. Partner"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={contact.name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={contact.phone ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={contact.email ?? ""}
          />
        </div>

        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/clients/${clientId}`}>Cancel</Link>
          </Button>
        </div>
      </form>

      <DeleteConfirmationButton
        entityName="emergency contact"
        onDelete={async () => {
          const result = await deleteEmergencyContact(
            clientId,
            contact.contactId
          )
          if (result.error) throw new Error(result.error)
          router.push(`/clients/${clientId}`)
        }}
      />
    </>
  )
}
