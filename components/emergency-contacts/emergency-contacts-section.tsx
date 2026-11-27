"use client"

import { useState } from "react"

import { TappableContactCard } from "@/components/clients/tappable-contact-card"
import { EmergencyContactDialog } from "@/components/emergency-contacts/emergency-contact-dialog"
import { formatAustralianPhone } from "@/lib/format/phone"
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

  function openAdd() {
    setEditingContact(null)
    setDialogOpen(true)
  }

  function openEdit(contact: EmergencyContactRow) {
    setEditingContact(contact)
    setDialogOpen(true)
  }

  return (
    <div className="mx-4 space-y-3">
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">None recorded</p>
      ) : (
        <ul className="space-y-3">
          {contacts.map((contact) => {
            const role = contact.role?.trim()
            return (
              <li key={contact.contactId}>
                <TappableContactCard
                  ariaLabel={`Edit ${contact.name}`}
                  onClick={() => openEdit(contact)}
                >
                  <div className="space-y-1">
                    <p>
                      <span className="font-medium">{contact.name}</span>
                      {role ? (
                        <span className="text-muted-foreground"> · {role}</span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground">
                      {contact.phone?.trim()
                        ? formatAustralianPhone(contact.phone)
                        : "No phone recorded"}
                    </p>
                    <p className="text-muted-foreground">
                      {contact.email?.trim() || "No email recorded"}
                    </p>
                  </div>
                </TappableContactCard>
              </li>
            )
          })}
        </ul>
      )}

      <button
        type="button"
        className="px-1 text-sm text-primary underline-offset-2 hover:underline"
        onClick={openAdd}
      >
        + Add emergency contact
      </button>

      <EmergencyContactDialog
        key={editingContact?.contactId ?? "new"}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingContact(null)
        }}
        clientId={clientId}
        contact={editingContact}
      />
    </div>
  )
}
