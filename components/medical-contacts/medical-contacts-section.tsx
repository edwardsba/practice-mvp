"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import {
  addMedicalContactAction,
  deleteMedicalContactAction,
  updateMedicalContactAction,
  type MedicalContactFormState,
} from "@/app/clients/[client_id]/medical-contacts/actions"
import { FormCheckboxField } from "@/components/treatment-plan/form-fields"
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
import {
  professionalOptionLabel,
  type ProfessionalOption,
} from "@/lib/client-background/professionals"
import { formatMedicalContactLabel } from "@/lib/medical-contacts/rules"

export type MedicalContactListItem = {
  medicalContactId: string
  professionalId: string
  isMain: boolean
  isResolvedMain: boolean
  notes: string | null
  supervisesLine: string
  professional: ProfessionalOption
}

const emptyState: MedicalContactFormState = {}

export function MedicalContactsSection({
  clientId,
  contacts,
  professionals,
}: {
  clientId: string
  contacts: MedicalContactListItem[]
  professionals: ProfessionalOption[]
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<MedicalContactListItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const availableToAdd = professionals.filter(
    (professional) =>
      !contacts.some((contact) => contact.professionalId === professional.professionalId)
  )

  async function onDelete(medicalContactId: string) {
    setDeleteError(null)
    const result = await deleteMedicalContactAction(clientId, medicalContactId)
    if (result.error) {
      setDeleteError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">None recorded</p>
      ) : (
        <ul className="space-y-3">
          {contacts.map((contact) => (
            <li
              key={contact.medicalContactId}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    {formatMedicalContactLabel(contact.professional)}
                    {contact.isResolvedMain ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Main contact
                      </span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground">
                    Supervises: {contact.supervisesLine}
                  </p>
                  {contact.notes?.trim() ? (
                    <p className="text-muted-foreground">{contact.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(contact)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onDelete(contact.medicalContactId)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteError ? (
        <p className="text-sm text-destructive" role="alert">
          {deleteError}
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setAddOpen(true)}
        disabled={availableToAdd.length === 0}
      >
        + Add medical contact
      </Button>
      {availableToAdd.length === 0 && professionals.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Every professional is already on this list.
        </p>
      ) : null}

      <MedicalContactDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clientId={clientId}
        professionals={availableToAdd}
        contact={null}
        onDone={() => router.refresh()}
      />
      <MedicalContactDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        clientId={clientId}
        professionals={professionals}
        contact={editing}
        onDone={() => {
          setEditing(null)
          router.refresh()
        }}
      />
    </div>
  )
}

function MedicalContactDialog({
  open,
  onOpenChange,
  clientId,
  professionals,
  contact,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  professionals: ProfessionalOption[]
  contact: MedicalContactListItem | null
  onDone: () => void
}) {
  const action = contact
    ? updateMedicalContactAction.bind(null, clientId, contact.medicalContactId)
    : addMedicalContactAction.bind(null, clientId)

  const [state, formAction, pending] = useActionState(action, emptyState)

  useEffect(() => {
    if (state.success) {
      onOpenChange(false)
      onDone()
    }
  }, [state.success, onOpenChange, onDone])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {contact ? "Edit medical contact" : "Add medical contact"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {contact ? (
            <p className="text-sm font-medium">
              {formatMedicalContactLabel(contact.professional)}
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="professional_id">Professional</Label>
              <select
                id="professional_id"
                name="professional_id"
                required
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                defaultValue=""
              >
                <option value="">Select…</option>
                {professionals.map((professional) => (
                  <option
                    key={professional.professionalId}
                    value={professional.professionalId}
                  >
                    {professionalOptionLabel(professional)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Need someone new?{" "}
                <Link
                  href="/contacts/professionals/new"
                  className="text-primary hover:underline"
                >
                  + Add professional
                </Link>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Note (optional)</Label>
            <Input
              id="notes"
              name="notes"
              defaultValue={contact?.notes ?? ""}
            />
          </div>

          <FormCheckboxField
            id="is_main"
            name="is_main"
            label="Main contact"
            defaultChecked={contact?.isMain ?? contact?.isResolvedMain ?? false}
          />

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
