"use client"

import { useState, useTransition } from "react"

import { deleteEmergencyContact } from "@/app/clients/[client_id]/emergency-contacts/actions"
import { EmergencyContactDialog } from "@/components/emergency-contacts/emergency-contact-dialog"
import { Button } from "@/components/ui/button"
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EmergencyContactRow } from "@/lib/crisis-plans/types"

export function EmergencyContactsSection({
  clientId,
  contacts,
}: {
  clientId: string
  contacts: EmergencyContactRow[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingContact, setEditingContact] =
    useState<EmergencyContactRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function openCreate() {
    setEditingContact(null)
    setDialogOpen(true)
  }

  function openEdit(contact: EmergencyContactRow) {
    setEditingContact(contact)
    setDialogOpen(true)
  }

  function handleRemove(contactId: string) {
    setError(null)
    startTransition(async () => {
      const result = await deleteEmergencyContact(clientId, contactId)
      if (result.error) {
        setError(result.error)
      }
    })
  }

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Emergency contacts</CardTitle>
        <Button type="button" size="sm" onClick={openCreate}>
          Add emergency contact
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                {contacts.length > 0 ? (
                  <TableHead className="text-right">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-20 text-center text-muted-foreground"
                  >
                    No emergency contacts on file.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.contactId}>
                    <TableCell>{contact.role ?? "—"}</TableCell>
                    <TableCell>{contact.name}</TableCell>
                    <TableCell>{contact.phone ?? "—"}</TableCell>
                    <TableCell>{contact.email ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(contact)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => handleRemove(contact.contactId)}
                        >
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <EmergencyContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        contact={editingContact}
      />
    </>
  )
}
