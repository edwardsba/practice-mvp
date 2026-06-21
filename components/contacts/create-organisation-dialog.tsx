"use client"

import { useActionState, useEffect, useRef } from "react"

import {
  createOrganisationFromDialog,
  type CreateOrganisationDialogState,
} from "@/lib/actions/contacts"
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

export function CreateOrganisationDialog({
  open,
  onOpenChange,
  practiceId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  practiceId: string
  onCreated: (organisation: {
    organisationId: string
    organisationName: string
  }) => void
}) {
  const action = createOrganisationFromDialog.bind(null, practiceId)
  const [state, formAction, pending] = useActionState(
    action,
    {} as CreateOrganisationDialogState
  )
  const formRef = useRef<HTMLFormElement>(null)
  const handledOrganisationIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (
      state.organisationId &&
      state.organisationName &&
      state.organisationId !== handledOrganisationIdRef.current
    ) {
      handledOrganisationIdRef.current = state.organisationId
      onCreated({
        organisationId: state.organisationId,
        organisationName: state.organisationName,
      })
      onOpenChange(false)
      formRef.current?.reset()
    }
  }, [state.organisationId, state.organisationName, onCreated, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create organisation</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dialog_organisation_name">Organisation name</Label>
            <Input id="dialog_organisation_name" name="organisation_name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dialog_organisation_type">Organisation type</Label>
            <Input id="dialog_organisation_type" name="organisation_type" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dialog_street_address">Street address</Label>
              <Input id="dialog_street_address" name="street_address" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog_postal_address">Postal address</Label>
              <Input id="dialog_postal_address" name="postal_address" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dialog_phone">Phone</Label>
              <Input id="dialog_phone" name="phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog_fax">Fax</Label>
              <Input id="dialog_fax" name="fax" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dialog_email">Email</Label>
              <Input id="dialog_email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog_claims_email">Claims email</Label>
              <Input id="dialog_claims_email" name="claims_email" type="email" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dialog_secure_messaging">Secure messaging</Label>
              <Input id="dialog_secure_messaging" name="secure_messaging" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog_website">Website</Label>
              <Input id="dialog_website" name="website" />
            </div>
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
              {pending ? "Creating…" : "Create organisation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
